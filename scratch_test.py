import urllib.request
import json

def test():
    print("Testing backend connectivity...")
    try:
        # 1. Test health endpoint
        response = urllib.request.urlopen("http://127.0.0.1:4000/api/v1/health")
        print("Health response:", response.read().decode())
    except Exception as e:
        print("Health check failed:", e)

if __name__ == "__main__":
    test()
