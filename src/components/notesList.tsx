import { Meeting, Meetings } from "@/common/model";
import { memo, useCallback } from "react";
import { FlatList } from "react-native";
import NotesListItem from "./notesListItem";

interface NotesListProps {
    meetings: Meetings;
    onMeetingPress: (meetingId: string) => void;
}

// ui
const NotesList = (props: NotesListProps) => {
    const { meetings, onMeetingPress } = props;
    const keyExtractor = useCallback((item: Meeting) => item.meetingId, []);

    const renderItem = useCallback(
        ({ item }: { item: Meeting }) => {
            return (
                <NotesListItem
                    item={item}
                    onPress={() => onMeetingPress(item.meetingId)}
                />
            );
        },
        [onMeetingPress],
    );

    return (
        <FlatList
            style={{ alignSelf: "stretch" }}
            data={meetings}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
        />
    );
};

export default memo(NotesList);
