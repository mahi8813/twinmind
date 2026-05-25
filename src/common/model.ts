export interface Meeting {
    meetingId: string;
    date: string;
    startTime: string;
    endTime: string | null;
}

export type Meetings = Meeting[];

export interface Chunk {
    chunkId: string;
    meetingId: string;
    uri: string;
    startTime: string;
    endTime: string;
    status: "queued" | "transcribed";
    transcription: string | null;
}

export type Chunks = Chunk[];
