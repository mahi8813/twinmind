import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { Chunk, Chunks, Meeting, Meetings } from "../common/model";

class DatabaseManager {
    private static instance: DatabaseManager;
    private db: SQLiteDatabase | null;

    public constructor() {
        this.db = null;
    }

    private async initializeDBIfNeeded(): Promise<SQLiteDatabase> {
        if (!this.db || !this.db.nativeDatabase) {
            this.db = await openDatabaseAsync("twinmind.db", {
                useNewConnection: Platform.OS === "android",
            });
            // Enable WAL journal mode and create tables if they don't exist.
            await this.db.execAsync("PRAGMA journal_mode = WAL;");
            await this.db.execAsync(
                "CREATE TABLE IF NOT EXISTS meetings (meetingId TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, startTime TEXT NOT NULL, endTime TEXT);",
            );
            await this.db.execAsync(
                "CREATE TABLE IF NOT EXISTS chunks (chunkId TEXT PRIMARY KEY NOT NULL, meetingId TEXT NOT NULL, uri TEXT NOT NULL, startTime TEXT NOT NULL, endTime TEXT NOT NULL, status TEXT NOT NULL, transcription TEXT);",
            );
        }
        return this.db;
    }

    public async saveMeeting(meeting: Meeting) {
        this.db = await this.initializeDBIfNeeded();
        await this.db.runAsync(
            "INSERT INTO meetings (meetingId, date, startTime, endTime) VALUES (?, ?, ?, ?)",
            meeting.meetingId,
            meeting.date,
            meeting.startTime,
            meeting.endTime,
        );
    }

    public async updateMeetingEndTime(meetingId: string, endTime: string) {
        this.db = await this.initializeDBIfNeeded();
        await this.db.runAsync(
            "UPDATE meetings SET endTime = ? WHERE meetingId = ?",
            endTime,
            meetingId,
        );
    }

    public async saveChunk(chunk: Chunk) {
        this.db = await this.initializeDBIfNeeded();
        await this.db.runAsync(
            "INSERT INTO chunks (chunkId, meetingId, uri, startTime, endTime, status, transcription) VALUES (?, ?, ?, ?, ?, ?, ?)",
            chunk.chunkId,
            chunk.meetingId,
            chunk.uri,
            chunk.startTime,
            chunk.endTime,
            chunk.status,
            chunk.transcription,
        );
    }

    public async updateChunkTranscription(
        chunkId: string,
        transcription: string,
    ) {
        this.db = await this.initializeDBIfNeeded();
        await this.db.runAsync(
            "UPDATE chunks SET transcription = ?, status = ? WHERE chunkId = ?",
            transcription,
            "transcribed",
            chunkId,
        );
    }

    public async getMeetings(): Promise<Meetings> {
        this.db = await this.initializeDBIfNeeded();
        return await this.db.getAllAsync(
            "SELECT * FROM meetings ORDER BY startTime DESC",
        );
    }

    public async getMeetingById(meetingId: string): Promise<Meeting | null> {
        this.db = await this.initializeDBIfNeeded();
        return await this.db.getFirstAsync(
            "SELECT * FROM meetings WHERE meetingId = ?",
            meetingId,
        );
    }

    public async getLiveMeeting(): Promise<Meeting | null> {
        this.db = await this.initializeDBIfNeeded();
        return await this.db.getFirstAsync(
            "SELECT * FROM meetings WHERE endtime IS NULL",
        );
    }

    public async getChunksByMeetingId(meetingId: string): Promise<Chunks> {
        this.db = await this.initializeDBIfNeeded();
        return await this.db.getAllAsync(
            "SELECT * FROM chunks WHERE meetingId = ?",
            meetingId,
        );
    }

    public async getQueuedChunks(): Promise<Chunks> {
        this.db = await this.initializeDBIfNeeded();
        return await this.db.getAllAsync(
            "SELECT * FROM chunks WHERE status = ? ORDER BY startTime ASC",
            "queued",
        );
    }

    public async deleteMeeting(meetingId: string) {
        this.db = await this.initializeDBIfNeeded();
        await this.db.runAsync(
            "DELETE FROM meetings WHERE meetingId = ?",
            meetingId,
        );
    }
}

export const dbManager = new DatabaseManager();
