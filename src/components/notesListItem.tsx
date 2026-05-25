import { Meeting } from "@/common/model";
import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

interface NotesListItemProps {
    item: Meeting;
    onPress: () => void;
}

const styles = StyleSheet.create({
    itemContainer: {
        borderColor: "#05284e",
        backgroundColor: "#f8f8f8",
        borderRadius: 25,
        borderWidth: 1,
        margin: 8,
        padding: 8,
    },
    titleView: {
        fontWeight: "bold",
        fontSize: 16,
        margin: 2,
    },
    subTitleView: {
        fontWeight: "normal",
        fontSize: 16,
        margin: 2,
    },
});

const NotesListItem = (props: NotesListItemProps) => {
    const { item, onPress } = props;
    return (
        <Pressable onPress={onPress} style={styles.itemContainer}>
            <Text style={styles.titleView}>{item.meetingId}</Text>
            <Text style={styles.subTitleView}>{item.date}</Text>
            <Text style={styles.subTitleView}>
                {`${item.startTime} - ${item.endTime || "🟢 Live"}`}
            </Text>
        </Pressable>
    );
};

export default memo(NotesListItem);
