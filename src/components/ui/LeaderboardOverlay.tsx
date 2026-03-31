import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { getTopPlayers, LeaderboardEntry } from '../../services/firebase/leaderboard'
import { log } from '../../utils/logger'

type Props = {
    visible: boolean
    onClose: () => void
}

export const LeaderboardOverlay = ({ visible, onClose }: Props) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!visible) return

        const fetchLeaderboard = async () => {
            setLoading(true)
            const data = await getTopPlayers(10)
            setEntries(data)
            setLoading(false)
        }

        fetchLeaderboard()
    }, [visible])

    if (!visible) return null

    return (
        <View style={styles.overlay}>
            <View style={styles.container}>
                <Text style={styles.title}>🏆 Leaderboard</Text>

                {loading ? (
                    <Text style={styles.loading}>Loading...</Text>
                ) : (
                    <ScrollView style={styles.list}>
                        {entries.map((entry, i) => (
                            <View key={entry.id} style={styles.row}>
                                <Text style={styles.rank}>{i + 1}.</Text>
                                <Text style={styles.name}>{entry.playerName}</Text>
                                <Text style={styles.score}>{entry.score}</Text>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '80%',
        backgroundColor: '#222',
        borderRadius: 16,
        padding: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFD700',
        textAlign: 'center',
        marginBottom: 12,
    },
    loading: {
        color: '#fff',
        textAlign: 'center',
        paddingVertical: 20,
    },
    list: {
        maxHeight: 300,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomColor: '#444',
        borderBottomWidth: 1,
    },
    rank: { color: '#FFD700', width: 24 },
    name: { color: '#fff', flex: 1 },
    score: { color: '#00FF00', width: 60, textAlign: 'right' },
    closeButton: {
        backgroundColor: '#555',
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    closeText: { color: '#fff', fontWeight: 'bold' },
})