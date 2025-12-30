import React from 'react';
import { View, Text, Button, Modal, StyleSheet } from 'react-native';
import WebSocketManager from '../../services/WebSocketManager';
import { Emitter } from '../../services/EventEmitter';
import { useContactStore } from '../../store/contactStore';

export default function CallScreen() {
  const getContactById = useContactStore(state => state.getContactById);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [callerId, setCallerId] = React.useState('');
  const [isIncoming, setIsIncoming] = React.useState(false);
  const [targetUserId, setTargetUserId] = React.useState<string | null>(null);


  React.useEffect(() => {
    const handleIncomingCall = (incomingCallerId: string) => {
      setCallerId(incomingCallerId);
      setTargetUserId(incomingCallerId);
      setIsIncoming(true);
      setModalVisible(true);
    };

    const handleCallStatus = (newStatus: string) => {
      setStatus(newStatus);
    };

    const handleStartCall = (targetId: string) => {
        setTargetUserId(targetId);
        setIsIncoming(false);
        setModalVisible(true);
    }
    
    const handleEndCall = () => {
        setModalVisible(false);
        setStatus('');
        setCallerId('');
        setIsIncoming(false);
    }

    Emitter.on('incomingCall', handleIncomingCall);
    Emitter.on('callStatus', handleCallStatus);
    Emitter.on('startCall', handleStartCall);
    Emitter.on('endCall', handleEndCall);


    return () => {
      Emitter.off('incomingCall', handleIncomingCall);
      Emitter.off('callStatus', handleCallStatus);
      Emitter.off('startCall', handleStartCall);
      Emitter.off('endCall', handleEndCall);
    };
  }, []);

  const answer = () => {
      WebSocketManager.callService?.answerCall();
      setIsIncoming(false);
  };

  const reject = () => {
      WebSocketManager.callService?.rejectCall();
      setModalVisible(false);
  };

  const hangup = () => {
      WebSocketManager.callService?.cleanup();
      setModalVisible(false);
  };

  return (
    <Modal visible={modalVisible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.username}>{targetUserId ? getContactById(targetUserId)?.name || 'Unknown' : 'Unknown'}</Text>


        {isIncoming ? (
           <View style={styles.buttonContainer}>
             <Text style={styles.incomingCallText}>{getContactById(callerId)?.name || 'Unknown'} is calling...</Text>
             <Button title="Answer" onPress={answer} />
             <Button title="Reject" onPress={reject} color="red" />
           </View>
        ) : (
            <View style={styles.buttonContainer}>
                <Button title="Hangup" onPress={hangup} color="red" />
            </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' },
  status: { color: 'white', fontSize: 24, marginBottom: 20 },
  username: { color: 'white', fontSize: 32, marginBottom: 50 },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  incomingCallText: {
    color: 'white',
    fontSize: 18,
    position: 'absolute',
    top: -150,
    alignSelf: 'center'
  }
});
