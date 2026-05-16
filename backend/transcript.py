"""YouTube transcript extraction with layered fallback.

1. youtube-transcript-api when installed
2. direct captions track fetch from the watch page
3. yt-dlp --write-auto-subs when available
"""
from __future__ import annotations

import json as _json
import logging
import re
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import httpx

try:  # Optional dependency; keep import-time failure from breaking the app.
    from youtube_transcript_api import YouTubeTranscriptApi  # type: ignore
    from youtube_transcript_api._errors import (  # type: ignore
        IpBlocked,
        NoTranscriptFound,
        RequestBlocked,
        TranscriptsDisabled,
        VideoUnavailable,
    )
except Exception:  # pragma: no cover - dependency is optional in this env
    YouTubeTranscriptApi = None

    class NoTranscriptFound(Exception):
        pass

    class TranscriptsDisabled(Exception):
        pass

    class VideoUnavailable(Exception):
        pass

    class IpBlocked(Exception):
        pass

    class RequestBlocked(Exception):
        pass

logger = logging.getLogger(__name__)


@dataclass
class TranscriptSegment:
    text: str
    start: float
    duration: float


@dataclass
class TranscriptResult:
    text: str
    language: str
    is_auto_generated: bool
    video_id: str
    segments: list[TranscriptSegment] = field(default_factory=list)


class TranscriptNotAvailable(Exception):
    pass


def _entries_to_result(entries, lang: str, auto: bool, video_id: str) -> TranscriptResult:
    segments = []
    for entry in entries:
        segments.append(TranscriptSegment(
            text=entry.text,
            start=entry.start,
            duration=entry.duration,
        ))
    text = " ".join(seg.text for seg in segments)
    return TranscriptResult(
        text=text,
        language=lang,
        is_auto_generated=auto,
        video_id=video_id,
        segments=segments,
    )


def _video_watch_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def _parse_video_id_from_url(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.netloc in {"youtu.be"}:
        return parsed.path.lstrip("/")[:11] or None
    if parsed.netloc.endswith("youtube.com"):
        qs = parse_qs(parsed.query)
        if "v" in qs and qs["v"]:
            return qs["v"][0][:11]
        match = re.search(r"/shorts/([A-Za-z0-9_-]{11})", parsed.path)
        if match:
            return match.group(1)
        match = re.search(r"/embed/([A-Za-z0-9_-]{11})", parsed.path)
        if match:
            return match.group(1)
    return None


def _fetch_captions_base_url(video_id: str, preferred_languages: list[str]) -> tuple[str, str, bool] | None:
    """Fetch a caption track base URL directly from the YouTube watch page."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
    }
    try:
        with httpx.Client(timeout=15.0, headers=headers, follow_redirects=True) as client:
            html = client.get(_video_watch_url(video_id)).text
    except Exception as e:
        logger.info(f"watch page fetch failed for {video_id}: {e}")
        return None

    patterns = [
        r'"captions":\s*\{(?:.|\n)*?"playerCaptionsTracklistRenderer":\s*\{(?P<body>(?:.|\n)*?)\}\s*\}',
        r'"captionTracks":\s*\[(?P<body>(?:.|\n)*?)\]',
    ]
    body = None
    for pattern in patterns:
        match = re.search(pattern, html)
        if match:
            body = match.group("body")
            break
    if not body:
        return None

    tracks = []
    for track_match in re.finditer(r'\{(?:[^{}]|\{[^{}]*\})*?"baseUrl"\s*:\s*"(?P<url>[^"]+)"(?:[^{}]|\{[^{}]*\})*?"languageCode"\s*:\s*"(?P<lang>[^"]+)"(?:[^{}]|\{[^{}]*\})*?(?:"kind"\s*:\s*"(?P<kind>[^"]+)")?', body):
        tracks.append(
            (
                unquote(track_match.group("url").replace("\\u0026", "&")),
                track_match.group("lang"),
                track_match.group("kind") == "asr",
            )
        )

    if not tracks:
        # More permissive fallback: parse any baseUrl/languageCode pair.
        urls = re.findall(r'"baseUrl"\s*:\s*"([^"]+)"', body)
        langs = re.findall(r'"languageCode"\s*:\s*"([^"]+)"', body)
        for idx, url in enumerate(urls):
            lang = langs[idx] if idx < len(langs) else preferred_languages[0]
            tracks.append((unquote(url.replace("\\u0026", "&")), lang, False))

    if not tracks:
        return None

    for pref in preferred_languages:
        for url, lang, auto in tracks:
            if lang.startswith(pref):
                return url, lang, auto

    url, lang, auto = tracks[0]
    return url, lang, auto


def _fetch_transcript_from_captions_track(video_id: str, preferred_languages: list[str]) -> TranscriptResult:
    track = _fetch_captions_base_url(video_id, preferred_languages)
    if not track:
        raise TranscriptNotAvailable("No caption track found on watch page")

    url, lang, auto = track
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            text = client.get(url).text
    except Exception as e:
        raise TranscriptNotAvailable(f"caption track fetch failed: {e}")

    # YouTube may return XML or JSON3 depending on the track.
    segments: list[TranscriptSegment] = []
    if text.lstrip().startswith("{"):
        segments = _parse_json3(text)
    else:
        for match in re.finditer(r"<text[^>]*start=\"(?P<start>[0-9.]+)\"[^>]*dur=\"(?P<dur>[0-9.]+)\"[^>]*>(?P<body>.*?)</text>", text):
            body = (
                match.group("body")
                .replace("&amp;", "&")
                .replace("&quot;", '"')
                .replace("&#39;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
            )
            segments.append(
                TranscriptSegment(
                    text=re.sub(r"<[^>]+>", "", body),
                    start=float(match.group("start")),
                    duration=float(match.group("dur")),
                )
            )

    if not segments:
        raise TranscriptNotAvailable("Caption track response was empty")

    return TranscriptResult(
        text=" ".join(seg.text for seg in segments),
        language=lang,
        is_auto_generated=auto,
        video_id=video_id,
        segments=segments,
    )


def fetch_transcript(
    video_id: str, preferred_languages: list[str] | None = None
) -> TranscriptResult:
    if preferred_languages is None:
        preferred_languages = ["ko", "en"]

    if YouTubeTranscriptApi is not None:
        try:
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)

            for lang in preferred_languages:
                try:
                    transcript = transcript_list.find_manually_created_transcript([lang])
                    entries = transcript.fetch()
                    return _entries_to_result(entries, lang, False, video_id)
                except NoTranscriptFound:
                    continue

            for lang in preferred_languages:
                try:
                    transcript = transcript_list.find_generated_transcript([lang])
                    entries = transcript.fetch()
                    return _entries_to_result(entries, lang, True, video_id)
                except NoTranscriptFound:
                    continue

            raise TranscriptNotAvailable(
                f"No transcript in {preferred_languages} for video {video_id}"
            )
        except (TranscriptsDisabled, VideoUnavailable, IpBlocked, RequestBlocked) as e:
            raise TranscriptNotAvailable(str(e))

    raise TranscriptNotAvailable("youtube-transcript-api is not installed")


def _parse_json3(content: str) -> list[TranscriptSegment]:
    data = _json.loads(content)
    events = data.get("events", []) or []
    segments: list[TranscriptSegment] = []
    for ev in events:
        segs = ev.get("segs") or []
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text:
            continue
        start_ms = ev.get("tStartMs", 0) or 0
        dur_ms = ev.get("dDurationMs", 0) or 0
        segments.append(TranscriptSegment(
            text=text,
            start=start_ms / 1000.0,
            duration=dur_ms / 1000.0,
        ))
    return segments


def fetch_transcript_via_ytdlp(
    video_id: str, preferred_languages: list[str] | None = None
) -> TranscriptResult:
    if preferred_languages is None:
        preferred_languages = ["ko", "en"]

    url = f"https://www.youtube.com/watch?v={video_id}"
    tmp_dir = tempfile.mkdtemp(prefix="ytdlp_subs_")

    try:
        cmd = [
            "yt-dlp",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs", ",".join(preferred_languages),
            "--sub-format", "json3",
            "--skip-download",
            "--no-playlist",
            "--quiet",
            "-o", str(Path(tmp_dir) / "%(id)s.%(ext)s"),
            url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        if result.returncode != 0:
            raise TranscriptNotAvailable(
                f"yt-dlp returned {result.returncode}: {result.stderr[:200]}"
            )

        candidates: list[tuple[Path, str, bool]] = []
        for lang in preferred_languages:
            for f in Path(tmp_dir).glob(f"*.{lang}.json3"):
                candidates.append((f, lang, True))

        if not candidates:
            raise TranscriptNotAvailable(
                f"yt-dlp produced no subtitle file in {preferred_languages}"
            )

        for path, lang, is_auto in candidates:
            try:
                content = path.read_text(encoding="utf-8")
                segments = _parse_json3(content)
                if not segments:
                    continue
                text = " ".join(s.text for s in segments)
                return TranscriptResult(
                    text=text,
                    language=lang,
                    is_auto_generated=is_auto,
                    video_id=video_id,
                    segments=segments,
                )
            except Exception as e:
                logger.warning(f"yt-dlp json3 parse failed for {path.name}: {e}")
                continue

        raise TranscriptNotAvailable("yt-dlp subtitle files were empty/unparseable")

    except subprocess.TimeoutExpired:
        raise TranscriptNotAvailable("yt-dlp subtitle fetch timed out")
    except FileNotFoundError:
        raise TranscriptNotAvailable("yt-dlp binary not found on PATH")
    finally:
        try:
            for f in Path(tmp_dir).iterdir():
                f.unlink()
            Path(tmp_dir).rmdir()
        except Exception:
            pass


def fetch_transcript_with_fallback(
    video_id: str, preferred_languages: list[str] | None = None
) -> TranscriptResult:
    if preferred_languages is None:
        preferred_languages = ["ko", "en"]

    try:
        return fetch_transcript(video_id, preferred_languages)
    except TranscriptNotAvailable as e:
        logger.info(f"timedtext API failed for {video_id} ({e}); trying watch-page captions")

    try:
        return _fetch_transcript_from_captions_track(video_id, preferred_languages)
    except TranscriptNotAvailable as e:
        logger.info(f"watch-page captions failed for {video_id} ({e}); trying yt-dlp")

    try:
        return fetch_transcript_via_ytdlp(video_id, preferred_languages)
    except TranscriptNotAvailable as e:
        raise TranscriptNotAvailable(str(e))
