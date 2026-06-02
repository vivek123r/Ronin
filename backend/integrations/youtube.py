import requests
from backend.utils.request_config import get


def search_youtube(query: str, max_results: int = 2) -> list:
    """Search YouTube and fetch transcripts."""
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
    videos = []
    try:
        resp = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part":              "snippet",
                "q":                 f"{query} review",
                "type":              "video",
                "maxResults":        max_results,
                "relevanceLanguage": "en",
                "regionCode":        "IN",
                "key":               get("YOUTUBE_API_KEY"),
            },
            timeout=8,
        )
        if resp.status_code != 200:
            print(f"⚠️  YouTube search HTTP {resp.status_code}: {resp.text[:200]}")
            return []

        for item in resp.json().get("items", []):
            vid_id  = item.get("id", {}).get("videoId")
            snippet = item.get("snippet", {})
            if not vid_id:
                continue

            transcript_text = ""
            try:
                raw = YouTubeTranscriptApi.get_transcript(vid_id, languages=["en", "en-US", "en-GB"])
                transcript_text = " ".join(seg["text"] for seg in raw[:120])
            except (NoTranscriptFound, TranscriptsDisabled):
                transcript_text = "[No transcript available]"
            except Exception as e:
                transcript_text = f"[Transcript error: {e}]"

            videos.append({
                "video_id":   vid_id,
                "title":      snippet.get("title", ""),
                "channel":    snippet.get("channelTitle", ""),
                "url":        f"https://www.youtube.com/watch?v={vid_id}",
                "transcript": transcript_text,
            })
    except Exception as e:
        print(f"⚠️  YouTube search failed: {e}")
    return videos
