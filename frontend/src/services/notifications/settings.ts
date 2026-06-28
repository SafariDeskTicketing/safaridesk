import http from '../http';
import { APIS } from '../apis';
import {
  OrganizationNotificationSettings,
  OrganizationNotificationSettingsPayload,
  UserNotificationPreference,
  UserNotificationPreferencePayload,
} from '../../types/notification';

export const getUserNotificationPreferences = async () => {
  const response = await http.get<UserNotificationPreference>(APIS.NOTIFICATION_USER_SETTINGS);
  return response.data;
};

export const updateUserNotificationPreferences = async (
  payload: UserNotificationPreferencePayload,
) => {
  const response = await http.put<UserNotificationPreference>(
    APIS.NOTIFICATION_USER_SETTINGS,
    payload,
  );
  return response.data;
};

export const getOrganizationNotificationSettings = async () => {
  const response = await http.get<OrganizationNotificationSettings>(APIS.NOTIFICATION_ORG_SETTINGS);
  return response.data;
};

export const updateOrganizationNotificationSettings = async (
  payload: OrganizationNotificationSettingsPayload,
) => {
  const response = await http.put<OrganizationNotificationSettings>(
    APIS.NOTIFICATION_ORG_SETTINGS,
    payload,
  );
  return response.data;
};
