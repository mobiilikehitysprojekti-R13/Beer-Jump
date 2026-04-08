import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
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
        <View style={styles.container}>
            <View style={styles.titleRow}>
                <MaterialCommunityIcons name='trophy-award' size={42} color='#FFA000' />
                <Text style={styles.title}>Leaderboard</Text>
            </View>

            {loading ? (
                <Text style={styles.loading}>Loading leaderboard...</Text>
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
    )
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#1a1a2e",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 20,
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#FFA000',
        textAlign: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    loading: {
        color: '#fff',
        textAlign: 'center',
        paddingVertical: 20,
        fontSize: 18,
    },
    list: {
        maxHeight: 400,
        width: '100%',
        maxWidth: 400,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomColor: '#444',
        borderBottomWidth: 1,
    },
    rank: { color: '#FFD700', width: 40, fontSize: 18 },
    name: { color: '#fff', flex: 1, fontSize: 18 },
    score: { color: '#00FF00', width: 80, textAlign: 'right', fontSize: 18 },
    closeButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#FFA000',
        paddingVertical: 10,
        paddingHorizontal: 32,
        borderRadius: 8,
        marginTop: 12,
    },
    closeText: { 
        color: '#FFA000', 
        fontWeight: 'bold',
        fontSize: 18,
    },
})