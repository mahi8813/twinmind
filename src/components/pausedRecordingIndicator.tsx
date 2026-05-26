import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

const styles = StyleSheet.create({
    textBox: {
        flexDirection: "row",
        justifyContent: "flex-start",
    },
    text: {
        color: "#0b6623",
        fontWeight: "bold",
        fontSize: 20,
    },
});

export default memo(function pausedRecordingIndicator(props: any) {
    return (
        <View style={styles.textBox}>
            <Text style={styles.text}>Paused. Click Resume to Continue</Text>
        </View>
    );
});
