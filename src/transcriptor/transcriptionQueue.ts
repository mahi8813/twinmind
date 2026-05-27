import { Chunk } from "@/common/model";
import { deleteChunkFileFromDocumentsDirectoryAsync } from "@/common/utils";
import { dbManager } from "@/database/dbManager";
import { transcribeAudio } from "@/transcriptor/transcriptionService";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

const TRANSCRIPTION_TASK_NAME = "TRANSCRIPTION_QUEUE_TASK";
const QUEUE_POLL_MS = 3000;
const BACKOFF_MS = 5000;
let taskDefined = false;

function defineBackgroundTask() {
    if (taskDefined) {
        return;
    }

    TaskManager.defineTask(TRANSCRIPTION_TASK_NAME, async () => {
        try {
            const didProcess =
                await transcriptionQueue.processQueuedChunksOnce();
            return didProcess
                ? BackgroundTask.BackgroundTaskResult.Success
                : BackgroundTask.BackgroundTaskResult.Failed;
        } catch (error) {
            console.error("[TranscriptionQueue] BackgroundTask error:", error);
            return BackgroundTask.BackgroundTaskResult.Failed;
        }
    });

    taskDefined = true;
}

export class TranscriptionQueue {
    private queue: Chunk[] = [];
    private running = false;
    private processing = false;
    private timer: ReturnType<typeof setTimeout> | null = null;

    public async start() {
        if (this.running) {
            return;
        }

        this.running = true;
        await this.syncQueuedChunks();
        // await this.registerBackgroundTask();
        this.scheduleWorker(0);
    }

    public stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    public enqueueChunk(chunk: Chunk) {
        if (!this.queue.some((item) => item.chunkId === chunk.chunkId)) {
            this.queue.push(chunk);
        }

        this.scheduleWorker(0);
    }

    private scheduleWorker(delayMs: number) {
        if (!this.running || this.timer) {
            return;
        }

        this.timer = setTimeout(async () => {
            this.timer = null;
            await this.processQueue();
        }, delayMs);
    }

    private async registerBackgroundTask() {
        defineBackgroundTask();

        try {
            await BackgroundTask.registerTaskAsync(TRANSCRIPTION_TASK_NAME, {
                minimumInterval: 15 * 60,
            });
        } catch (error) {
            console.warn(
                "[TranscriptionQueue] BackgroundTask task already registered or failed:",
                error,
            );
        }
    }

    public async processQueuedChunksOnce(): Promise<boolean> {
        if (this.processing) {
            return false;
        }

        this.processing = true;

        // In a background task invocation, the in-memory queue may be empty.
        // Sync from the database only when we have nothing queued locally.
        if (this.queue.length === 0) {
            await this.syncQueuedChunks();
        }

        let didProcess = false;
        while (this.queue.length > 0) {
            const chunk = this.queue.shift()!;

            try {
                const transcription = await transcribeAudio(chunk.uri);
                if (typeof transcription === "string")
                    await dbManager.updateChunkTranscription(
                        chunk.chunkId,
                        transcription,
                    );

                await deleteChunkFileFromDocumentsDirectoryAsync(chunk.uri);

                didProcess = true;
            } catch (error) {
                console.error(
                    "[TranscriptionQueue] Failed to transcribe chunk:",
                    chunk.chunkId,
                    error,
                );

                this.queue.push(chunk);
                await this.wait(BACKOFF_MS);
            }
        }

        this.processing = false;
        return didProcess;
    }

    private async processQueue() {
        if (this.processing) {
            return;
        }

        await this.processQueuedChunksOnce();

        if (this.running) {
            this.scheduleWorker(QUEUE_POLL_MS);
        }
    }

    private async syncQueuedChunks() {
        const queuedChunks = await dbManager.getQueuedChunks();
        for (const queuedChunk of queuedChunks) {
            if (
                !this.queue.some((item) => item.chunkId === queuedChunk.chunkId)
            ) {
                this.queue.push(queuedChunk);
            }
        }
    }

    private wait(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }
}

export const transcriptionQueue = new TranscriptionQueue();
