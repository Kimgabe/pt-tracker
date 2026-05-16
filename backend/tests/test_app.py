import asyncio

import main


def test_import_main_and_app_exists():
    assert main.app.title == "PT Tracker Analysis API"


def test_extract_video_id_variants():
    assert main.extract_video_id("https://www.youtube.com/watch?v=abcdefghijk") == "abcdefghijk"
    assert main.extract_video_id("https://youtu.be/abcdefghijk") == "abcdefghijk"
    assert main.extract_video_id("https://www.youtube.com/shorts/abcdefghijk") == "abcdefghijk"


def test_analyze_workout_response_with_stubs(monkeypatch):
    class DummyTranscript:
        text = "bench press 3 sets of 10"
        language = "en"
        is_auto_generated = False
        segments = []

    def fake_fetch_transcript(video_id):
        return DummyTranscript()

    def fake_metadata(video_url):
        return {"title": "Upper Body Workout", "author": "Coach A"}

    def fake_extract_workout_staged(*args, **kwargs):
        return {
            "workout_name": "상체 루틴",
            "exercises": [
                {"name": "벤치프레스", "sets": 3, "reps": "10", "rest_seconds": 60},
            ],
            "total_duration_min": 30,
            "workout_type": "strength",
        }

    monkeypatch.setattr(main, "fetch_transcript_with_fallback", fake_fetch_transcript)
    monkeypatch.setattr(main, "fetch_video_metadata", fake_metadata)
    monkeypatch.setattr(main, "extract_workout_staged", fake_extract_workout_staged)

    req = main.AnalyzeRequest(url="https://www.youtube.com/watch?v=abcdefghijk", content_type="workout", auto_save=False)
    response = asyncio.run(main.analyze(req))

    assert response.detected_type == "workout"
    assert response.video_title == "Upper Body Workout"
    assert response.saved_id is None
    assert response.cached is False
    assert response.confidence_score > 0
    assert response.workout is not None
    assert response.workout.workout_name == "상체 루틴"
    assert response.workout.exercises[0].name == "벤치프레스"
