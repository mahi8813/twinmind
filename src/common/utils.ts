import * as FileSystem from "expo-file-system/legacy";
import { Chunk } from "./model";

export type ChunkHandler = (
    chunkUri: string,
    startTime: string,
    endTime: string,
) => void;

export const moveChunkFileToDocumentsDirectoryAsync = async (
    chunkUri: string,
): Promise<string> => {
    const uniqueFileName = `recording-${Date.now()}.m4a`;
    const customFilePath = `${FileSystem.documentDirectory}${uniqueFileName}`;
    await FileSystem.moveAsync({
        from: chunkUri,
        to: customFilePath,
    });
    return customFilePath;
};

export const deleteChunkFileFromDocumentsDirectoryAsync = async (
    chunkUri: string,
): Promise<void> => {
    return await FileSystem.deleteAsync(chunkUri);
};

export const buildChunk = (
    meetingId: string,
    chunkUri: string,
    startTime: string,
    endTime: string,
): Chunk => ({
    chunkId: `${meetingId}_Chunk_${startTime}`,
    meetingId,
    uri: chunkUri,
    startTime,
    endTime,
    status: "queued",
    transcription: null,
});
