export const WRITE: { [TypeName: string]: { [KeyName: string]: boolean } } = {
    intrusionDetectionControlState: {
        remainingTimeUntilArmed: false
    },
    // Yale
    doorSensor: {
        doorState: false
    },
    lockActuator: {
        canUnlatch: false
    }
}