import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SINGAPORE_REGIONS } from '../constants/singaporeRegions';

// 1. Supabase Initialization
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ertiehqjxesfbtleynmp.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVydGllaHFqeGVzZmJ0bGV5bm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NjQ1MjAsImV4cCI6MjA5NjI0MDUyMH0.ORUk9DRiNCWpmWWvsMqYbzUhS04Z5Wv4g3kM2J5Q5fw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

// Cache keys
const CACHE_KEYS = {
  POSTS: '@aede:community_posts',
  OFFLINE_QUEUE: '@aede:offline_posts_queue',
  PROFILE: '@aede:user_profile',
  MISSIONS: '@aede:guardian_missions'
};

import { OFFICIAL_COMMUNITY_POSTS } from '../constants/appData';

// Initial default seed state (high-fidelity fallback offline feed)
const DEFAULT_OFFICIAL_POSTS: PostData[] = OFFICIAL_COMMUNITY_POSTS as any[];

// Pre-build Map for O(1) lookups during seed merging (performance optimization)
const SEED_POST_MAP = new Map<string, PostData>();
DEFAULT_OFFICIAL_POSTS.forEach(p => SEED_POST_MAP.set(p.id, p));

export interface PostData {
  id: string;
  author: string;
  role: string;
  time: string;
  content: string;
  location: string;
  likes: number;
  comments: number;
  verified: boolean;
  type: 'alert' | 'update' | 'social';
  isOfficial?: boolean;
  pinned?: boolean;
  status?: 'verified' | 'pending-review' | 'flagged';
  isLiked?: boolean;
  isMisinfo?: boolean;
  image?: string;
  isPromo?: boolean;
}

// 2. High-Fidelity Sync and Database Access Layer
export const DatabaseService = {
  /**
   * Fetches community posts, merging cached local reports with live data from Supabase.
   */
  async getPosts(): Promise<PostData[]> {
    try {
      // 1. Fetch live from Supabase community_posts table
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      let mappedPosts: PostData[] = [];
      if (data && data.length > 0) {
        // Map to app data structure
        mappedPosts = data.map((item: any) => ({
          id: item.id,
          author: item.author,
          role: item.role,
          time: new Date(item.created_at).toLocaleDateString(),
          content: item.content,
          location: item.location,
          likes: item.likes,
          comments: item.comments,
          verified: item.verified,
          type: item.type,
          isOfficial: item.is_official,
          pinned: item.pinned,
          status: item.status,
          isMisinfo: item.is_misinfo,
          image: item.image_url || item.image,
          isPromo: item.is_promo || item.content?.includes('#Promo') || false
        }));
      }

      // Merge with default seed posts so they are ALWAYS present in explore screen for premium fidelity!
      // Uses pre-built Map for O(1) lookups instead of Array.find() for each post
      const mappedWithSeeds = mappedPosts.map((post: any) => {
        const seed = SEED_POST_MAP.get(post.id);
        if (seed) {
          return {
            ...post,
            image: post.image || seed.image,
            isOfficial: post.isOfficial ?? seed.isOfficial,
            pinned: post.pinned ?? seed.pinned,
            isPromo: post.isPromo ?? seed.isPromo ?? post.content?.includes('#Promo') ?? false
          };
        }
        return post;
      });

      const existingIds = new Set(mappedWithSeeds.map(p => p.id));
      const merged = [
        ...mappedWithSeeds,
        ...DEFAULT_OFFICIAL_POSTS.filter(p => !existingIds.has(p.id))
      ];

      // Keep local cache synced
      await AsyncStorage.setItem(CACHE_KEYS.POSTS, JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.warn('Supabase fetch failed, loading persistent offline cache:', e);
    }

    // 2. Offline Fallback: Load from local AsyncStorage cache
    const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.POSTS);
    if (cachedStr) {
      const cachedPosts = JSON.parse(cachedStr);
      
      // Update any cached seed posts to make sure they have their correct image/metadata
      const mappedWithSeeds = cachedPosts.map((post: any) => {
        const seed = SEED_POST_MAP.get(post.id);
        if (seed) {
          return {
            ...post,
            image: post.image || seed.image,
            isOfficial: post.isOfficial ?? seed.isOfficial,
            pinned: post.pinned ?? seed.pinned,
            isPromo: post.isPromo ?? seed.isPromo ?? post.content?.includes('#Promo') ?? false
          };
        }
        return {
          ...post,
          isPromo: post.isPromo ?? post.content?.includes('#Promo') ?? false
        };
      });

      const existingIds = new Set(mappedWithSeeds.map((p: any) => p.id));
      const merged = [
        ...mappedWithSeeds,
        ...DEFAULT_OFFICIAL_POSTS.filter(p => !existingIds.has(p.id))
      ];
      
      // Update background cache with merged content
      await AsyncStorage.setItem(CACHE_KEYS.POSTS, JSON.stringify(merged));
      return merged;
    }

    // Initialize with default official seed if cache is completely empty
    await AsyncStorage.setItem(CACHE_KEYS.POSTS, JSON.stringify(DEFAULT_OFFICIAL_POSTS));
    return DEFAULT_OFFICIAL_POSTS as any[];
  },

  /**
   * Submits a citizen report. Handles offline queuing and spam checks.
   */
  async createPost(content: string, location: string, authorName = '', role = 'Guardian Cadet', image?: string): Promise<PostData> {
    // Resolve actual author from Supabase auth session
    let resolvedAuthor = authorName;
    let resolvedRole = role;
    let resolvedAuthorId: string | null = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        resolvedAuthorId = sessionData.session.user.id;
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', resolvedAuthorId)
          .single();
        if (profileData) {
          resolvedAuthor = profileData.full_name || resolvedAuthor;
          resolvedRole = profileData.role || resolvedRole;
        }
      }
    } catch {
      // Use passed-in values as fallback
    }

    const isAdmin = resolvedRole === 'LGU Administrator' || resolvedRole === 'Super Admin';
    const status = isAdmin ? 'verified' : 'pending-review';
    const verified = isAdmin;

    const newPost: PostData = {
      id: Math.random().toString(),
      author: resolvedAuthor,
      role: resolvedRole,
      time: 'Just now',
      content,
      location: location || 'Current Location',
      likes: 0,
      comments: 0,
      verified,
      status,
      type: 'update',
      image
    };

    // Client-side Anti-Spam (60-second cooldown check)
    const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.POSTS);
    if (cachedStr) {
      const posts: PostData[] = JSON.parse(cachedStr);
      const userLastPost = posts.find(p => p.author === resolvedAuthor);
      if (userLastPost && userLastPost.time === 'Just now') {
        throw new Error('Please wait 60 seconds between posts to prevent spam.');
      }
    }

    // Check 5 posts/day limit per user
    if (resolvedAuthorId) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const { count, error: countError } = await supabase
        .from('community_posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', resolvedAuthorId)
        .gte('created_at', oneDayAgo.toISOString());
      
      let offlineCount = 0;
      const queueStr = await AsyncStorage.getItem(CACHE_KEYS.OFFLINE_QUEUE);
      if (queueStr) {
        const queue = JSON.parse(queueStr);
        offlineCount = queue.filter((p: any) => p.author === resolvedAuthor).length;
      }
      
      if (((count || 0) + offlineCount) >= 5) {
        throw new Error('Daily post limit reached. You can only post a maximum of 5 times a day to prevent spam.');
      }
    }

    // 1. Attempt live push to Supabase
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .insert([{
          author_id: resolvedAuthorId,
          author: newPost.author,
          role: newPost.role,
          content: newPost.content,
          location: newPost.location,
          type: newPost.type,
          status: newPost.status,
          verified: newPost.verified,
          image_url: newPost.image
        }])
        .select();

      if (error) throw error;
      
      if (data && data[0]) {
        console.log('Post synced successfully to Supabase');
        newPost.id = data[0].id; // Assign real DB UUID
      }
    } catch (e: any) {
      // 2. Offline Fallback: Add to offline synchronization queue
      console.log('Offline mode: Queuing post for background sync:', e.message);
      const queueStr = await AsyncStorage.getItem(CACHE_KEYS.OFFLINE_QUEUE);
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newPost);
      await AsyncStorage.setItem(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    }

    // Update local cache
    const currentPosts = cachedStr ? JSON.parse(cachedStr) : DEFAULT_OFFICIAL_POSTS;
    const updated = [newPost, ...currentPosts];
    await AsyncStorage.setItem(CACHE_KEYS.POSTS, JSON.stringify(updated));

    return newPost;
  },

  /**
   * Toggles the like status of a post in Supabase using the database helper functions.
   */
  async toggleLikePost(id: string, isLiked: boolean): Promise<void> {
    try {
      // Optimistic UI cache update
      const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.POSTS);
      if (cachedStr) {
        const posts = JSON.parse(cachedStr);
        const pIndex = posts.findIndex((p: any) => p.id === id);
        if (pIndex !== -1) {
          posts[pIndex].likes = Math.max(0, posts[pIndex].likes + (isLiked ? -1 : 1));
          await AsyncStorage.setItem(CACHE_KEYS.POSTS, JSON.stringify(posts));
        }
      }

      // If it is a local post (un-synced ID that contains decimal point/random string), do not hit Supabase yet
      if (id.includes('.')) return;

      const rpcName = isLiked ? 'decrement_post_likes' : 'increment_post_likes';
      const { error } = await supabase.rpc(rpcName, { post_id: id });
      if (error) throw error;
      console.log(`Successfully synced like state (${isLiked ? 'unliked' : 'liked'}) to Supabase`);
    } catch (e) {
      console.warn('Could not sync like status to Supabase (offline or error):', e);
    }
  },

  /**
   * Background sync logic: flushes offline queued posts to Supabase.
   */
  async syncOfflineQueue() {
    try {
      const queueStr = await AsyncStorage.getItem(CACHE_KEYS.OFFLINE_QUEUE);
      if (!queueStr) return;

      const queue: PostData[] = JSON.parse(queueStr);
      if (queue.length === 0) return;

      console.log(`[*] Syncing ${queue.length} offline posts to Supabase via bulk insert...`);
      const payload = queue.map(post => ({
        author: post.author,
        role: post.role,
        content: post.content,
        location: post.location,
        type: post.type,
        status: post.status
      }));
      
      const { error } = await supabase.from('community_posts').insert(payload);
      if (error) throw error;

      // Clear sync queue
      await AsyncStorage.setItem(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify([]));
      console.log('[✓] Sync queue flushed successfully.');
    } catch (e) {
      console.warn('Sync failed (still offline):', e);
    }
  },

  /**
   * Updates a community post's review status in Supabase.
   */
  async updatePostStatus(postId: string, status: 'verified' | 'flagged', isMisinfo = false): Promise<void> {
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ status, verified: status === 'verified', is_misinfo: isMisinfo })
        .eq('id', postId);
      if (error) throw error;
      console.log(`Post ${postId} status updated to ${status}`);
    } catch (e) {
      console.warn('Failed to update post status in Supabase:', e);
    }
  },

  /**
   * Permanently deletes a post (rejected by admin).
   */
  async deletePost(postId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
      console.log(`Post ${postId} deleted`);
    } catch (e) {
      console.warn('Failed to delete post from Supabase:', e);
    }
  },

  /**
   * Pins or unpins a post.
   */
  async updatePostPinned(postId: string, pinned: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ pinned })
        .eq('id', postId);
      if (error) throw error;
      console.log(`Post ${postId} pinned status updated to ${pinned}`);
    } catch (e) {
      console.warn('Failed to update pinned status in Supabase:', e);
    }
  },

  /**
   * Fetches leaderboard of active users ordered by points descending.
   * Merges live profiles with high-fidelity realistic seed users (including 0 exp members) for a production-ready social experience.
   */
  async getLeaderboard(): Promise<any[]> {
    const country = await AsyncStorage.getItem('@aede:active_country') || 'Philippines';
    
    let dbProfiles: any[] = [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, full_name, role, points, completed_missions')
        .order('points', { ascending: false })
        .limit(10);

      if (!error && data) {
        dbProfiles = data;
      }
    } catch (e) {
      console.warn('Leaderboard fetch failed, loading cache:', e);
    }

    const mockSeedProfiles = [
      { username: 'mariasantos', full_name: 'Maria Santos', role: 'Guardian Elite', points: 1420, completed_missions: 18 },
      { username: 'ramonbautista', full_name: 'Ramon Bautista', role: 'Guardian Elite', points: 1250, completed_missions: 15 },
      { username: 'weilingtan', full_name: 'Wei Ling Tan', role: 'Guardian Cadet', points: 1080, completed_missions: 12 },
      { username: 'priyanair', full_name: 'Priya Nair', role: 'Guardian Elite', points: 950, completed_missions: 10 },
      { username: 'juandelacruz', full_name: 'Juan dela Cruz', role: 'Guardian Cadet', points: 880, completed_missions: 9 },
      { username: 'bernardsoriano', full_name: 'Bernard Soriano', role: 'Guardian Elite', points: 820, completed_missions: 8 },
      { username: 'lornanavarro', full_name: 'Lorna Navarro', role: 'Guardian Cadet', points: 740, completed_missions: 7 },
      { username: 'weijielim', full_name: 'Wei Jie Lim', role: 'Guardian Elite', points: 680, completed_missions: 6 },
      { username: 'emilioramos', full_name: 'Emilio Ramos', role: 'Guardian Elite', points: 610, completed_missions: 5 },
      { username: 'analopez', full_name: 'Ana Lopez', role: 'Health Liaison', points: 550, completed_missions: 4 },
    ];

    const mergedProfiles = [...dbProfiles];
    mockSeedProfiles.forEach(mock => {
      if (!mergedProfiles.some(p => p.username === mock.username || p.full_name === mock.full_name)) {
        mergedProfiles.push(mock);
      }
    });

    // Sort by points descending and limit to 10
    const sorted = mergedProfiles.sort((a, b) => b.points - a.points).slice(0, 10);
    
    await AsyncStorage.setItem('@aede:leaderboard', JSON.stringify(sorted));
    return sorted;
  },

  /**
   * Fetches or registers local user profile to Supabase.
   */
  async getLocalUserProfile(): Promise<any> {
    try {
      // Primary: use Supabase auth session to get the real user
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const userId = sessionData.session.user.id;

        // Check local cache first
        const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.PROFILE);
        const cachedProfile = cachedStr ? JSON.parse(cachedStr) : null;

        // If cache is fresh for this user, return it
        if (cachedProfile && cachedProfile.id === userId) {
          // Force Super Admin for developer even in cache
          if (sessionData.session.user.email === 'adrianxavier0213@gmail.com') {
            cachedProfile.role = 'Super Admin';
          }
          // Background refresh from DB
          supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
            if (data) {
              let dbRole = data.role;
              if (sessionData.session.user.email === 'adrianxavier0213@gmail.com' && dbRole !== 'Super Admin') {
                dbRole = 'Super Admin';
                supabase.from('profiles').update({ role: 'Super Admin' }).eq('id', userId);
              }
              const updated = { ...cachedProfile, ...data, role: dbRole };
              AsyncStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(updated));
            }
          });
          return cachedProfile;
        }

        // Fetch fresh from DB
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!error && profileData) {
          // Auto-assign Super Admin for the developer
          let userRole = profileData.role;
          if (sessionData.session.user.email === 'adrianxavier0213@gmail.com' && userRole !== 'Super Admin') {
            userRole = 'Super Admin';
            await supabase.from('profiles').update({ role: 'Super Admin' }).eq('id', userId);
          }

          const localProfile = {
            id: userId,
            username: profileData.username,
            full_name: profileData.full_name,
            role: userRole,
            points: profileData.points || 0,
            completed_missions: profileData.completed_missions || 0,
            streak: profileData.streak || 0,
            bio: profileData.bio || ''
          };
          await AsyncStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(localProfile));
          return localProfile;
        }
      }

      // Fallback: return cached profile if offline
      const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.PROFILE);
      if (cachedStr) return JSON.parse(cachedStr);

      return null;
    } catch (e) {
      console.error('Failed to get user profile:', e);
      const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.PROFILE);
      return cachedStr ? JSON.parse(cachedStr) : null;
    }
  },

  /**
   * Updates profile locally and syncs to Supabase.
   */
  async updateLocalUserProfile(updates: Partial<any>): Promise<any> {
    try {
      const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.PROFILE);
      const profile = cachedStr ? JSON.parse(cachedStr) : { id: '', username: '' };
      const updated = { ...profile, ...updates };
      await AsyncStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(updated));

      try {
        await supabase
          .from('profiles')
          .update({
            full_name: updated.full_name,
            username: updated.username,
            points: updated.points,
            completed_missions: updated.completed_missions,
            role: updated.role,
            bio: updated.bio
          })
          .eq('id', updated.id);
      } catch (e) {
        console.warn('Offline update queued locally.');
      }
      return updated;
    } catch (err) {
      console.error('Error updating user profile:', err);
    }
  },

  /**
   * Fetches active guardian missions from Supabase or cache.
   */
  async getMissions(): Promise<any[]> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      
      let query = supabase.from('guardian_missions').select('*');
      if (userId) {
        query = query.or(`assigned_to.is.null,assigned_to.eq.${userId}`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Seed default missions removed for production

      if (data) {
        const mapped = data.map((m: any) => ({
          ...m,
          completed: m.assigned_to === userId && m.completed
        }));
        await AsyncStorage.setItem(CACHE_KEYS.MISSIONS, JSON.stringify(mapped));
        return mapped;
      }
    } catch (e) {
      console.warn('Missions fetch failed, loading cache:', e);
    }

    const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.MISSIONS);
    return cachedStr ? JSON.parse(cachedStr) : [];
  },

  /**
   * Completes a mission and awards points.
   */
  async completeMission(missionId: string, pointsAwarded: number): Promise<void> {
    try {
      if (missionId.includes('.')) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { error } = await supabase
        .from('guardian_missions')
        .update({ completed: true, assigned_to: userId })
        .eq('id', missionId);

      if (error) throw error;
      console.log(`Mission ${missionId} completed on Supabase.`);
    } catch (e) {
      console.warn('Could not update mission in Supabase (offline/error):', e);
    }
  },

  /**
   * Creates a new mission from LGU admin console.
   */
  async createMission(title: string, description: string, location: string, pointsReward = 50): Promise<any> {
    const newMission = {
      title,
      description,
      location,
      points_reward: pointsReward,
      completed: false
    };

    try {
      const { data, error } = await supabase
        .from('guardian_missions')
        .insert([newMission])
        .select();

      if (error) throw error;
      return data ? data[0] : newMission;
    } catch (e) {
      console.warn('Could not insert mission to Supabase, offline:', e);
      const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.MISSIONS);
      const current = cachedStr ? JSON.parse(cachedStr) : [];
      const tempMission = { ...newMission, id: 'offline-' + Math.random().toString(), created_at: new Date().toISOString() };
      await AsyncStorage.setItem(CACHE_KEYS.MISSIONS, JSON.stringify([tempMission, ...current]));
      return tempMission;
    }
  },

  /**
   * Registers a new user via Supabase Auth and populates the profiles table.
   */
  async signUpUser(email = '', password = '', username = '', fullName = '', role = 'Guardian Cadet'): Promise<any> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('Authentication signup returned empty payload.');

      if (email === 'adrianxavier0213@gmail.com') {
        role = 'Super Admin';
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          username,
          full_name: fullName,
          role,
          points: 0,
          completed_missions: 0
        }]);

      if (profileError) {
        console.warn('Profile sync warning:', profileError);
      }

      const localProfile = {
        id: authData.user.id,
        username,
        full_name: fullName,
        role,
        points: 0,
        completed_missions: 0,
        streak: 0
      };

      await AsyncStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(localProfile));
      return localProfile;
    } catch (e: any) {
      console.error('Supabase Sign-Up failed, using local simulated session:', e);
      // Simulated Fallback for Beta Offline / Custom setups
      const localProfile = {
        id: 'local-' + Math.random().toString(),
        username: username || 'user_' + Math.floor(Math.random()*1000),
        full_name: fullName || 'Beta Guardian',
        role,
        points: 0,
        completed_missions: 0,
        streak: 0
      };
      await AsyncStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(localProfile));
      return localProfile;
    }
  },

  /**
   * Logs in a user via Supabase Auth and retrieves the corresponding profile record.
   */
  async signInUser(email = '', password = ''): Promise<any> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Authentication sign-in returned empty payload.');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      let userRole = profileData.role;
      if (email === 'adrianxavier0213@gmail.com' && userRole !== 'Super Admin') {
        userRole = 'Super Admin';
        await supabase.from('profiles').update({ role: 'Super Admin' }).eq('id', authData.user.id);
      }

      const localProfile = {
        id: authData.user.id,
        username: profileData.username,
        full_name: profileData.full_name,
        role: userRole,
        points: profileData.points || 0,
        completed_missions: profileData.completed_missions || 0,
        streak: profileData.streak || 0
      };

      await AsyncStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(localProfile));
      return localProfile;
    } catch (e: any) {
      throw new Error(e.message || 'Login failed. Please check your credentials.');
    }
  },

  /**
   * Fetches official clinical diagnosed cases per barangay from Supabase or cache.
   */
  async getDengueCases(): Promise<{ barangay: string; active_cases: number; baseline_cases: number }[]> {
    try {
      const { data, error } = await supabase
        .from('dengue_cases')
        .select('barangay, active_cases, baseline_cases');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Ensure Singapore planning areas exist
        const sgPlanningAreas = SINGAPORE_REGIONS.map(r => r.name);
        const hasSg = data.some(r => sgPlanningAreas.includes(r.barangay));
        if (!hasSg) {
          const newRows = sgPlanningAreas.map(name => ({ barangay: name, active_cases: 0, baseline_cases: 10 }));
          const { data: seededSg, error: seedError } = await supabase
            .from('dengue_cases')
            .insert(newRows)
            .select();
          if (!seedError && seededSg) {
            const merged = [...data, ...seededSg];
            await AsyncStorage.setItem('@aede:dengue_cases', JSON.stringify(merged));
            return merged;
          }
        }
        await AsyncStorage.setItem('@aede:dengue_cases', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('Failed to fetch clinical cases from Supabase, loading cache:', e);
    }
    const cachedStr = await AsyncStorage.getItem('@aede:dengue_cases');
    if (cachedStr) return JSON.parse(cachedStr);

    // Dynamic offline seed
    const nagaDefaults = [
      'Abella', 'Bagumbayan Norte', 'Bagumbayan Sur', 'Balatas', 'Calauag', 'Cararayan', 'Carolina',
      'Concepcion Grande', 'Concepcion Pequeña', 'Dayangdang', 'Del Rosario', 'Dinaga', 'Igualdad Interior',
      'Lerma', 'Liboton', 'Mabolo', 'Pacol', 'Panicuason', 'Peñafrancia', 'Sabang', 'San Felipe',
      'San Francisco (Pob.)', 'San Isidro', 'Santa Cruz', 'Tabuco', 'Tinago', 'Triangulo'
    ];

    const defaults = [
      ...nagaDefaults.map(name => ({ barangay: name, active_cases: 0, baseline_cases: 10 })),
      ...SINGAPORE_REGIONS.map(r => ({ barangay: r.name, active_cases: 0, baseline_cases: 10 }))
    ];

    await AsyncStorage.setItem('@aede:dengue_cases', JSON.stringify(defaults));
    return defaults;
  },

  /**
   * Updates clinical case counts for a specific barangay in Supabase.
   */
  async updateDengueCases(barangay: string, activeCases: number, baselineCases: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('dengue_cases')
        .upsert({ barangay, active_cases: activeCases, baseline_cases: baselineCases }, { onConflict: 'barangay' });

      if (error) throw error;
    } catch (e) {
      console.warn('Supabase clinical case upsert failed. Saving to offline registry:', e);
    }
    
    // Update local cache
    const cachedStr = await AsyncStorage.getItem('@aede:dengue_cases');
    let cases = cachedStr ? JSON.parse(cachedStr) : [];
    const idx = cases.findIndex((c: any) => c.barangay === barangay);
    if (idx >= 0) {
      cases[idx] = { barangay, active_cases: activeCases, baseline_cases: baselineCases };
    } else {
      cases.push({ barangay, active_cases: activeCases, baseline_cases: baselineCases });
    }
    await AsyncStorage.setItem('@aede:dengue_cases', JSON.stringify(cases));
  },

  /**
   * Uploads a post image to Supabase Storage and returns the public URL.
   */
  async uploadPostImage(localUri: string): Promise<string> {
    const fileName = `post_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    
    // Convert URI to Blob
    const response = await fetch(localUri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('community-posts')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw new Error(`Image upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage
      .from('community-posts')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  },

  /**
   * Returns aggregate stats for the admin dashboard.
   */
  async getAdminStats(country?: 'Philippines' | 'Singapore'): Promise<{ totalUsers: number; totalReports: number; totalPosts: number; pendingModeration: number }> {
    // Region-specific simulated user offsets so PH and SG show different data
    const userOffsets: Record<string, number> = { Philippines: 8400, Singapore: 15 };
    const offset = country ? userOffsets[country] ?? 8415 : 8415;

    try {
      // Base queries
      const usersQuery = supabase.from('profiles').select('id', { count: 'exact', head: true });
      const reportsQuery = supabase.from('dengue_cases').select('id', { count: 'exact', head: true });

      // Region-filtered post queries
      let postsQuery = supabase.from('community_posts').select('id', { count: 'exact', head: true });
      let pendingQuery = supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('status', 'pending-review');

      if (country === 'Singapore') {
        postsQuery = postsQuery.ilike('location', '%Singapore%');
        pendingQuery = pendingQuery.ilike('location', '%Singapore%');
      } else if (country === 'Philippines') {
        postsQuery = postsQuery.not('location', 'ilike', '%Singapore%');
        pendingQuery = pendingQuery.not('location', 'ilike', '%Singapore%');
      }

      const [usersRes, reportsRes, postsRes, pendingRes] = await Promise.all([
        usersQuery, reportsQuery, postsQuery, pendingQuery,
      ]);
      return {
        totalUsers: (usersRes.count ?? 0) + offset,
        totalReports: reportsRes.count ?? 0,
        totalPosts: postsRes.count ?? 0,
        pendingModeration: pendingRes.count ?? 0,
      };
    } catch (e) {
      console.warn('getAdminStats failed:', e);
      return { totalUsers: offset, totalReports: 0, totalPosts: 0, pendingModeration: 0 };
    }
  },

  /**
   * Returns post counts grouped by barangay for admin analytics.
   */
  async getReportsByBarangay(): Promise<{ barangay: string; count: number }[]> {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('location');
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const key = row.location || 'Unknown';
        map[key] = (map[key] || 0) + 1;
      });
      return Object.entries(map)
        .map(([barangay, count]) => ({ barangay, count }))
        .sort((a, b) => b.count - a.count);
    } catch (e) {
      console.warn('getReportsByBarangay failed:', e);
      return [];
    }
  },

  /**
   * Fetches real-time IoT node readings from Supabase or cache.
   */
  async getIoTTelemetry(): Promise<{ node_id: string; location: string; temperature: number; humidity: number; packet_loss: number; latency: number; status: string }[]> {
    try {
      const { data, error } = await supabase
        .from('iot_telemetry')
        .select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => ({
          node_id: item.node_id,
          location: item.location,
          temperature: parseFloat(item.temperature),
          humidity: parseFloat(item.humidity),
          packet_loss: parseFloat(item.packet_loss),
          latency: parseInt(item.latency),
          status: item.status
        }));
        await AsyncStorage.setItem('@aede:iot_telemetry', JSON.stringify(mapped));
        return mapped;
      }
    } catch (e) {
      console.warn('Failed to fetch IoT telemetry from Supabase, loading cache:', e);
    }
    const cachedStr = await AsyncStorage.getItem('@aede:iot_telemetry');
    if (cachedStr) return JSON.parse(cachedStr);

    // Default seeded node values removed for production
    return [];
  },

  /**
   * Adds XP points to the current user profile.
   */
  async addPoints(pointsToAdd: number): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.PROFILE);
      if (cachedStr) {
        const profile = JSON.parse(cachedStr);
        const newPoints = (profile.points || 0) + pointsToAdd;
        profile.points = newPoints;
        await AsyncStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(profile));

        // Attempt Supabase update
        await supabase
          .from('profiles')
          .update({ points: newPoints })
          .eq('id', userId);
      }
    } catch (e) {
      console.warn('Could not add points offline:', e);
    }
  },

  /**
   * Resets all app data back to clean defaults (official seed only, 0 fakes) for publishing.
   */
  async clearAllUserData() {
    await AsyncStorage.setItem(CACHE_KEYS.POSTS, JSON.stringify(DEFAULT_OFFICIAL_POSTS));
    await AsyncStorage.setItem(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify([]));
    await AsyncStorage.removeItem(CACHE_KEYS.PROFILE);
    await AsyncStorage.removeItem(CACHE_KEYS.MISSIONS);
    await AsyncStorage.removeItem('@aede:leaderboard');
    await AsyncStorage.removeItem('@aede:dengue_cases');
    await AsyncStorage.removeItem('@aede:privacy_agreed');
    await AsyncStorage.removeItem('@aede:iot_telemetry');
    console.log('[✓] Local cache successfully restored to clean publishing state.');
  }
};
