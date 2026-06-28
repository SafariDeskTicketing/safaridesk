import http from './http';
import { APIS } from './apis';

export interface Category {
  id?: number;
  name: string;
}

export interface Vendor {
  id?: number;
  name: string;
}

export const getCategories = async (): Promise<Category[]> => {
  const response = await http.get(APIS.ASSET_MANAGEMENT_CATEGORIES);
  return response.data;
};

export const createCategory = async (category: { name: string }): Promise<Category> => {
  const response = await http.post(APIS.ASSET_MANAGEMENT_CATEGORIES, category);
  return response.data;
};

export const updateCategory = async (id: number, category: { name: string }): Promise<Category> => {
  const response = await http.put(`${APIS.ASSET_MANAGEMENT_CATEGORIES}${id}/`, category);
  return response.data;
};

export const deleteCategory = async (id: number): Promise<void> => {
  await http.delete(`${APIS.ASSET_MANAGEMENT_CATEGORIES}${id}/`);
};

export const getVendors = async (): Promise<Vendor[]> => {
  const response = await http.get(APIS.ASSET_MANAGEMENT_VENDORS);
  return response.data;
};

export const createVendor = async (vendor: { name: string }): Promise<Vendor> => {
  const response = await http.post(APIS.ASSET_MANAGEMENT_VENDORS, vendor);
  return response.data;
};

export const updateVendor = async (id: number, vendor: { name: string }): Promise<Vendor> => {
  const response = await http.put(`${APIS.ASSET_MANAGEMENT_VENDORS}${id}/`, vendor);
  return response.data;
};

export const deleteVendor = async (id: number): Promise<void> => {
  await http.delete(`${APIS.ASSET_MANAGEMENT_VENDORS}${id}/`);
};

export const getLocations = async (): Promise<any[]> => {
  const response = await http.get(APIS.ASSET_MANAGEMENT_LOCATIONS);
  return response.data;
};

export const createLocation = async (location: { name: string }): Promise<any> => {
  const response = await http.post(APIS.ASSET_MANAGEMENT_LOCATIONS, location);
  return response.data;
};
