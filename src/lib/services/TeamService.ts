import { supabase } from '../supabase';
import { db, LocalTeam } from '../db';
import { Team } from './types';
import { syncManager } from '../sync/SyncManager';
import { v4 as uuidv4 } from 'uuid';
import { nowISO } from '../utils/timestamp';

export class TeamService {
    /**
     * Get all teams for the current master user
     */
    async getTeams(masterUserId: string): Promise<Team[]> {
        try {
            // Try to get from local DB first
            const localTeams = await db.teams
                .where('master_user_id')
                .equals(masterUserId)
                .filter(t => !t._deleted)
                .toArray();

            if (localTeams.length > 0) {
                return localTeams;
            }

            // If offline or no local data, return empty (sync will handle it)
            if (!navigator.onLine) {
                return [];
            }

            // Fetch from Supabase
            const { data, error } = await supabase
                .from('teams')
                .select('*')
                .eq('master_user_id', masterUserId)
                .eq('is_active', true);

            if (error) throw error;

            // Cache to local DB
            if (data) {
                await db.teams.bulkPut(data.map(team => ({
                    ...team,
                    _syncStatus: 'synced',
                    _lastModified: nowISO(),
                    _version: 1,
                    _deleted: false
                })));
                return data;
            }

            return [];
        } catch (error) {
            console.error('Error fetching teams:', error);
            return [];
        }
    }

    /**
     * Create a new team
     */
    async createTeam(team: Omit<Team, 'id' | 'created_at' | 'updated_at'>): Promise<Team> {
        const newTeam: Team = {
            ...team,
            id: uuidv4(),
            created_at: nowISO(),
            updated_at: nowISO()
        };

        // Save to local DB
        const localTeam: LocalTeam = {
            ...newTeam,
            _syncStatus: 'pending',
            _lastModified: nowISO(),
            _version: 1,
            _deleted: false
        };

        await db.teams.add(localTeam);

        // Queue sync
        await syncManager.addToSyncQueue('teams', 'create', newTeam.id, newTeam);

        return newTeam;
    }

    /**
     * Update a team
     */
    async updateTeam(id: string, updates: Partial<Omit<Team, 'id' | 'created_at'>>): Promise<void> {
        const team = await db.teams.get(id);
        if (!team) throw new Error('Team not found');

        const updatedTeam = {
            ...team,
            ...updates,
            updated_at: nowISO(),
            _syncStatus: 'pending' as const,
            _lastModified: nowISO(),
            _version: team._version + 1
        };

        await db.teams.put(updatedTeam);

        // Queue sync
        await syncManager.addToSyncQueue('teams', 'update', id, updates);
    }

    /**
     * Delete a team (soft delete)
     */
    async deleteTeam(id: string): Promise<void> {
        const team = await db.teams.get(id);
        if (!team) throw new Error('Team not found');

        await db.teams.update(id, {
            _deleted: true,
            _syncStatus: 'pending',
            _lastModified: nowISO(),
            updated_at: nowISO()
        });

        // Queue sync
        await syncManager.addToSyncQueue('teams', 'delete', id, { id });
    }

    /**
     * Validate team PIN
     */
    async validateTeamPIN(teamId: string, pin: string): Promise<boolean> {
        const team = await db.teams.get(teamId);
        if (!team) {
            // Try fetching from Supabase if not found locally
            const { data } = await supabase
                .from('teams')
                .select('pin')
                .eq('id', teamId)
                .single();

            if (data) {
                return data.pin === pin;
            }
            return false;
        }

        return team.pin === pin;
    }
}

export const teamService = new TeamService();
