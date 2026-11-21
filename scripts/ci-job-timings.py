import json
import sys
from datetime import datetime


def ts(x):
    return datetime.strptime(x, '%Y-%m-%dT%H:%M:%SZ')


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/jobs.json'
    with open(path) as f:
        pages = json.load(f)
    print('## CI job timings')
    print('')
    print('| Job | Result | Seconds |')
    print('|---|---|---|')
    for page in pages:
        for job in page.get('jobs', []):
            started = job.get('started_at')
            completed = job.get('completed_at')
            seconds = ''
            if started and completed:
                seconds = str(int((ts(completed) - ts(started)).total_seconds()))
            result = job.get('conclusion') or job.get('status') or '?'
            print(f'| {job["name"]} | {result} | {seconds} |')


if __name__ == '__main__':
    main()
