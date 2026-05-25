Twin Mind App Architecture

Expo App with

- Audio Recorder
- Chunk Queue Manager
- AI Transcription Worker
- Local Storage
- History & Transcription UI

Twin Mind System Design

For MVPscope, all meeting data and transcriptions are stored locally on-device using SQLite without an internal backend.

Audio Recorder: - Expo-audio api - Record audio in 30 second chunks with 1 sec overlap - Continuous recording in background & even when device is offline. - Interruptions should resume recording/chunking - Phone calls - Bluetooth disconnect - pause/resume recording by user. - Users kills & restart - OS kills & restart

Chunk Queue Manager: - Persistent Queue using SQLite

- Audio blobs stored on filesystem - documents/chunks/
  -chunk_001.m4a
  -chunk_002.m4a - Metadata stored in SQL Chunk Table
  Each Row = [
  meetingId,
  chunkId,
  uri,
  …
  ]

        AI Transcription Worker:
        - Uploads queued chunks to Grok API
        - Chunk uploading
        	- when app is in foreground
        	- actively recording in background(leverage audio background session to upload chunks)
        	- For MVP, using background tasks or background sessions for uploading is out of scope.
        - Store Transcription in Chunk Table.
            - Clean up successfully transcribed audio chunks
        - Failure cases
        	1. Network not reachable
        		 - Retry when network is reachable.
        	2. Server not reachable/ Any other API failure
        		 - Retry with exponential backoff.
        - Retry should happen until success or maxRetryCount.

        Local Storage
        - Expo-SQLite
        - Persistent Storage with SQL DB.
        - Chunks Table Schema = 	[
        							chunkId,
        							meetingId,
        							uri,
        							status,
        							createdAt,
        							uploadedAt,
        							retryCount,
        							failureReason,
        							transcription
        			    			]
        	* status = [queued, uploading, transcribed]
        	* failureReason = [network, server]
        - Meetings Table Schema =		[
        								meetingId,
        								date,
        								startTime,
        								endTime,
        								duration,
        								isLive
        							]
        - All meetings can be queried from meeting table
        - Each meeting transcriptions can be queried from Chunks Table


        History & Transcription UI
        	- History Page
        		-  List all meetings & capture button at the bottom.
        		-  Shows Title, Date, Time and Duration.
        		- Ongoing meetings shows live instead of duration
        		- OnClick of a meeting -> Transcription page of past meeting
        		- OnClick of capture -> Transcription page of new meeting
        	- Transcription page
        		- Lists transcriptions of a past meeting
        		- Shows timer & listening message for live meetings
        		- If transcriptions are not available yet, app should show syncing data.
        	-

Identified a flaw in existing TwinMind UI:
-When device is offline and there are chunks to sync, the app says syncing on both pages and showing loading indicator. Instead it should say Device is offline and connect to network to syncing transcription.
