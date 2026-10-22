from backend.app.services.source_analyzer import analyze_repository 


def test_analyze_repository():
    repo_path = "/Users/suchayjoshi/Desktop/voice_assistant"
    files = analyze_repository(repo_path)
    for file in files: 
        print(file.path, file.language, file.size) 
    print(f"Total sources: {len(files)}")
    assert len(files) > 0


