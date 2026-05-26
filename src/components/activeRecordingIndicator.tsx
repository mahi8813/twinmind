import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        justifyContent: "flex-start",
    },
    text: {
        color: "#0b6623",
        fontWeight: "bold",
        fontSize: 20,
    },
});

export default memo(function ActiveRecordingIndicator(props: any) {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>I am listening and taking notes</Text>
            <ActivityIndicator size="large" />
        </View>
    );
});
