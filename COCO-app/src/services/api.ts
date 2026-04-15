import { supabase } from './supabase';
import { AuthUser, User, Group, GroupWithMembers, StatusGroup, StatusMe, MapData, Area, AreaWithUsers } from '../types';
import { findSmallestArea, isPointInArea } from '../utils/location';

const DEFAULT_USER_ICON_URL = 'https://example.com/default-user-icon.png';
const DEFAULT_GROUP_ICON_URL = 'https://example.com/default-group-icon.png';

type DbGroup = {
  id: string;
  name: string;
  icon_url: string | null;
  owner_user_id: string;
};

type DbArea = {
  id: string;
  group_id: string;
  name: string;
  center_latitude: number | string;
  center_longitude: number | string;
  radius_meters: number | string;
};

type DbUser = {
  id: string;
  display_name: string;
  email: string;
  icon_url: string | null;
};

type DbLocation = {
  user_id: string;
  latitude: number | string;
  longitude: number | string;
  recorded_at: string;
};

const mapGroup = (group: DbGroup): Group => ({
  id: group.id,
  name: group.name,
  iconUrl: group.icon_url || DEFAULT_GROUP_ICON_URL,
  ownerUserId: group.owner_user_id
});

const mapArea = (area: DbArea): Area => ({
  id: area.id,
  groupId: area.group_id,
  name: area.name,
  centerLatitude: Number(area.center_latitude),
  centerLongitude: Number(area.center_longitude),
  radiusMeters: Number(area.radius_meters)
});

const mapUser = (user: DbUser): User => ({
  id: user.id,
  displayName: user.display_name,
  email: user.email,
  iconUrl: user.icon_url || DEFAULT_USER_ICON_URL
});

const getCurrentAuthUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

const getMyGroups = async (): Promise<Group[]> => {
  const userId = await getCurrentAuthUserId();
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      groups (
        id,
        name,
        icon_url,
        owner_user_id
      )
    `)
    .eq('user_id', userId);
  if (error) throw error;

  return ((data || []) as any[])
    .map(item => item.groups)
    .filter(Boolean)
    .map((group: DbGroup) => mapGroup(group));
};

const getAreasForGroup = async (groupId: string): Promise<Area[]> => {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('group_id', groupId);
  if (error) throw error;

  return ((data || []) as DbArea[]).map(mapArea);
};

const getMembersForGroup = async (groupId: string): Promise<User[]> => {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      users (
        id,
        display_name,
        email,
        icon_url
      )
    `)
    .eq('group_id', groupId);
  if (error) throw error;

  return ((data || []) as any[])
    .map(item => item.users)
    .filter(Boolean)
    .map((user: DbUser) => mapUser(user));
};

const getLocationsForUserIds = async (userIds: string[]): Promise<Map<string, DbLocation>> => {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('user_locations')
    .select('user_id, latitude, longitude, recorded_at')
    .in('user_id', userIds);
  if (error) throw error;

  return new Map(((data || []) as DbLocation[]).map(location => [location.user_id, location]));
};

const getActiveInviteLink = async (groupId: string): Promise<{ url: string; token: string } | undefined> => {
  const { data, error } = await supabase
    .from('group_invite_links')
    .select('token')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.token) return undefined;

  return { url: `coco://invite/${data.token}`, token: data.token };
};

// Auth API
export const authApi = {
  signup: async (displayName: string, email: string, password: string): Promise<AuthUser> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          icon_url: DEFAULT_USER_ICON_URL
        }
      }
    });
    if (error) throw error;
    if (!data.user) throw new Error('User creation failed');

    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: data.user.id,
        display_name: displayName,
        email,
        icon_url: DEFAULT_USER_ICON_URL
      });
    if (profileError) throw profileError;

    const user: AuthUser = {
      id: data.user.id,
      displayName,
      email,
      iconUrl: DEFAULT_USER_ICON_URL,
      session: {
        accessToken: data.session?.access_token || '',
        refreshToken: data.session?.refresh_token || ''
      }
    };
    return user;
  },

  login: async (email: string, password: string): Promise<AuthUser> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    if (!data.user) throw new Error('Login failed');

    const user: AuthUser = {
      id: data.user.id,
      displayName: data.user.user_metadata?.display_name || '',
      email: data.user.email || '',
      iconUrl: data.user.user_metadata?.icon_url || DEFAULT_USER_ICON_URL,
      session: {
        accessToken: data.session?.access_token || '',
        refreshToken: data.session?.refresh_token || ''
      }
    };
    return user;
  },

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getMe: async (): Promise<User> => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Not authenticated');

    const { data, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    return {
      id: data.id,
      displayName: data.display_name,
      email: data.email,
      iconUrl: data.icon_url
    };
  }
};

// Status API
export const statusApi = {
  getGroups: async (): Promise<StatusGroup[]> => {
    const userId = await getCurrentAuthUserId();
    const groups = await getMyGroups();

    const statusGroups = await Promise.all(groups.map(async group => {
      const [areas, members] = await Promise.all([
        getAreasForGroup(group.id),
        getMembersForGroup(group.id)
      ]);
      const locations = await getLocationsForUserIds(members.map(member => member.id));
      const latestActivityAt = Array.from(locations.values())
        .map(location => location.recorded_at)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || '';

      const hasOtherUsersInsideArea = members
        .filter(member => member.id !== userId)
        .some(member => {
          const location = locations.get(member.id);
          return Boolean(location && findSmallestArea(Number(location.latitude), Number(location.longitude), areas));
        });

      return {
        groupId: group.id,
        groupName: group.name,
        groupIconUrl: group.iconUrl,
        hasOtherUsersInsideArea,
        latestActivityAt
      };
    }));

    return statusGroups.sort((a, b) => new Date(b.latestActivityAt || 0).getTime() - new Date(a.latestActivityAt || 0).getTime());
  },

  getMe: async (): Promise<StatusMe[]> => {
    const userId = await getCurrentAuthUserId();
    const groups = await getMyGroups();
    const locations = await getLocationsForUserIds([userId]);
    const myLocation = locations.get(userId);

    return Promise.all(groups.map(async group => {
      const areas = await getAreasForGroup(group.id);
      const isInsideAnyArea = Boolean(
        myLocation && findSmallestArea(Number(myLocation.latitude), Number(myLocation.longitude), areas)
      );

      return {
        groupId: group.id,
        groupName: group.name,
        groupIconUrl: group.iconUrl,
        isInsideAnyArea
      };
    }));
  },

  update: async (latitude: number, longitude: number): Promise<{ recordedAt: string }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const recordedAt = new Date().toISOString();
    const { error } = await supabase
      .from('user_locations')
      .upsert({
        user_id: user.id,
        latitude,
        longitude,
        recorded_at: recordedAt
      }, { onConflict: 'user_id' });
    if (error) throw error;

    return { recordedAt };
  }
};

// Group API
export const groupApi = {
  create: async (name: string, iconUrl: string): Promise<Group> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('groups')
      .insert({
        name,
        icon_url: iconUrl || DEFAULT_GROUP_ICON_URL,
        owner_user_id: user.id
      })
      .select()
      .single();
    if (error) throw error;

    // Create invite link
    const token = Math.random().toString(36).substring(2);
    const { error: inviteError } = await supabase
      .from('group_invite_links')
      .insert({
        group_id: data.id,
        token,
        created_by_user_id: user.id,
        is_active: true
      });
    if (inviteError) throw inviteError;

    // Add creator as member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: data.id,
        user_id: user.id
      });
    if (memberError) throw memberError;

    return {
      id: data.id,
      name: data.name,
      iconUrl: data.icon_url || DEFAULT_GROUP_ICON_URL,
      ownerUserId: data.owner_user_id
    };
  },

  getAll: async (): Promise<Group[]> => {
    return getMyGroups();
  },

  getDetail: async (groupId: string): Promise<GroupWithMembers> => {
    const userId = await getCurrentAuthUserId();
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('id, name, icon_url, owner_user_id')
      .eq('id', groupId)
      .single();
    if (groupError) throw groupError;

    const [members, areas, inviteLink] = await Promise.all([
      getMembersForGroup(groupId),
      getAreasForGroup(groupId),
      getActiveInviteLink(groupId)
    ]);
    const locations = await getLocationsForUserIds(members.map(member => member.id));

    return {
      ...mapGroup(groupData as DbGroup),
      inviteLink,
      members: members
        .map(member => {
          const location = locations.get(member.id);
          const area = location
            ? findSmallestArea(Number(location.latitude), Number(location.longitude), areas)
            : null;

          return {
            userId: member.id,
            displayName: member.displayName,
            iconUrl: member.iconUrl,
            displayArea: area
              ? { type: 'area' as const, areaId: area.id, areaName: area.name }
              : { type: 'outside' as const },
            recordedAt: location?.recorded_at || '',
            isMe: member.id === userId
          };
        })
        .sort((a, b) => Number(b.isMe) - Number(a.isMe))
    };
  },

  leave: async (groupId: string): Promise<{ success: boolean; groupDeleted: boolean }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id);
    if (error) throw error;

    // Check if group should be deleted
    const { data: members } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId);

    const groupDeleted = !members || members.length === 0;
    if (groupDeleted) {
      await supabase.from('groups').delete().eq('id', groupId);
    }

    return { success: true, groupDeleted };
  }
};

// Area API
export const areaApi = {
  create: async (groupId: string, name: string, centerLatitude: number, centerLongitude: number, radiusMeters: number): Promise<Area> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('areas')
      .insert({
        group_id: groupId,
        name,
        center_latitude: centerLatitude,
        center_longitude: centerLongitude,
        radius_meters: radiusMeters,
        created_by_user_id: user.id
      })
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      centerLatitude: data.center_latitude,
      centerLongitude: data.center_longitude,
      radiusMeters: data.radius_meters
    };
  },

  getDetail: async (areaId: string): Promise<AreaWithUsers> => {
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('id', areaId)
      .single();
    if (error) throw error;

    const area = mapArea(data as DbArea);
    const members = await getMembersForGroup(area.groupId);
    const locations = await getLocationsForUserIds(members.map(member => member.id));

    return {
      ...area,
      users: members
        .filter(member => {
          const location = locations.get(member.id);
          return Boolean(
            location &&
            isPointInArea(Number(location.latitude), Number(location.longitude), area)
          );
        })
        .map(member => ({
          userId: member.id,
          displayName: member.displayName,
          iconUrl: member.iconUrl,
          recordedAt: locations.get(member.id)?.recorded_at || ''
        }))
    };
  },

  update: async (areaId: string, name: string): Promise<Area> => {
    const { error } = await supabase
      .from('areas')
      .update({ name })
      .eq('id', areaId);
    if (error) throw error;

    const { data, error: selectError } = await supabase
      .from('areas')
      .select('*')
      .eq('id', areaId)
      .single();
    if (selectError) throw selectError;

    return {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      centerLatitude: data.center_latitude,
      centerLongitude: data.center_longitude,
      radiusMeters: data.radius_meters
    };
  },

  delete: async (areaId: string): Promise<void> => {
    const { error } = await supabase
      .from('areas')
      .delete()
      .eq('id', areaId);
    if (error) throw error;
  }
};

// Map API
export const mapApi = {
  getData: async (groupId: string): Promise<MapData> => {
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('id, name, icon_url, owner_user_id')
      .eq('id', groupId)
      .single();
    if (groupError) throw groupError;

    const [areas, members] = await Promise.all([
      getAreasForGroup(groupId),
      getMembersForGroup(groupId)
    ]);
    const locations = await getLocationsForUserIds(members.map(member => member.id));

    return {
      group: mapGroup(groupData as DbGroup),
      areas: areas.map(area => ({
        ...area,
        hasUsersInside: members.some(member => {
          const location = locations.get(member.id);
          return Boolean(
            location &&
            isPointInArea(Number(location.latitude), Number(location.longitude), area)
          );
        })
      }))
    };
  }
};

// Invite API
export const inviteApi = {
  getInfo: async (token: string): Promise<{ group: Group; isActive: boolean }> => {
    const { data, error } = await supabase
      .from('group_invite_links')
      .select(`
        is_active,
        groups (
          id,
          name,
          icon_url,
          owner_user_id
        )
      `)
      .eq('token', token)
      .single();
    if (error) throw error;
    const group = (Array.isArray((data as any).groups) ? (data as any).groups[0] : (data as any).groups) as DbGroup;

    return {
      group: mapGroup(group),
      isActive: data.is_active
    };
  },

  join: async (token: string): Promise<{ groupId: string; joined: boolean }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: link, error: linkError } = await supabase
      .from('group_invite_links')
      .select('group_id')
      .eq('token', token)
      .eq('is_active', true)
      .single();
    if (linkError) throw linkError;

    const { error } = await supabase
      .from('group_members')
      .upsert({
        group_id: link.group_id,
        user_id: user.id
      }, { onConflict: 'group_id,user_id' });
    if (error) throw error;

    return { groupId: link.group_id, joined: true };
  },

  regenerate: async (groupId: string): Promise<{ url: string; token: string }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check ownership
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('owner_user_id')
      .eq('id', groupId)
      .single();
    if (groupError) throw groupError;
    if (group.owner_user_id !== user.id) throw new Error('Not group owner');

    // Deactivate old links
    await supabase
      .from('group_invite_links')
      .update({ is_active: false })
      .eq('group_id', groupId);

    // Create new link
    const token = Math.random().toString(36).substring(2);
    const { error } = await supabase
      .from('group_invite_links')
      .insert({
        group_id: groupId,
        token,
        created_by_user_id: user.id,
        is_active: true
      });
    if (error) throw error;

    return { url: `coco://invite/${token}`, token };
  }
};
