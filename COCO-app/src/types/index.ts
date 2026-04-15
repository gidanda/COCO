// User types
export interface User {
  id: string;
  displayName: string;
  email: string;
  iconUrl: string;
}

export interface AuthUser extends User {
  session: {
    accessToken: string;
    refreshToken: string;
  };
}

// Group types
export interface Group {
  id: string;
  name: string;
  iconUrl: string;
  ownerUserId: string;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
  inviteLink?: {
    url: string;
    token: string;
  };
}

export interface GroupMember {
  userId: string;
  displayName: string;
  iconUrl: string;
  displayArea: DisplayArea;
  recordedAt: string;
  isMe: boolean;
}

export interface DisplayArea {
  type: 'area' | 'outside';
  areaId?: string;
  areaName?: string;
}

// Area types
export interface Area {
  id: string;
  groupId: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
}

export interface AreaWithUsers extends Area {
  users: AreaUser[];
}

export interface AreaUser {
  userId: string;
  displayName: string;
  iconUrl: string;
  recordedAt: string;
}

// Status types
export interface StatusGroup {
  groupId: string;
  groupName: string;
  groupIconUrl: string;
  hasOtherUsersInsideArea: boolean;
  latestActivityAt: string;
}

export interface StatusMe {
  groupId: string;
  groupName: string;
  groupIconUrl: string;
  isInsideAnyArea: boolean;
}

// Map types
export interface MapData {
  group: Group;
  areas: MapArea[];
}

export interface MapArea extends Area {
  hasUsersInside: boolean;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}