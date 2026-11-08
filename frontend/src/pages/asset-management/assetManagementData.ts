import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import type { Asset } from '../../types';
import {
  getCategories,
  getVendors,
  createCategory,
  createVendor,
  type Category,
  type Vendor,
} from '../../services/categoryVendorService';

export type { Category, Vendor };

export const useAssetCategoriesQuery = () =>
  useQuery<Category[]>({ queryKey: ['asset-categories'], queryFn: getCategories });

export const useAssetVendorsQuery = () =>
  useQuery<Vendor[]>({ queryKey: ['asset-vendors'], queryFn: getVendors });

export const useCreateAssetCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asset-categories'] }),
  });
};

export const useCreateAssetVendorMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVendor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asset-vendors'] }),
  });
};

/**
 * The wire shape from AssetSerializer: `category`/`vendor` are the raw FK ids,
 * with the nested objects carried separately under `*_detail`. The `Asset`
 * type from `types/index.tsx` models `category`/`vendor` as the nested
 * objects directly (matching how the rest of this page renders them), so
 * every response is transformed through `transformApiAsset` below rather than
 * assumed to match on the wire - mirrors `ApiTicket`/`transformApiTicket` in
 * `pages/ticket/list/ticketListData.ts`.
 */
interface ApiAssetCategory {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface ApiAssetVendor {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ApiAsset {
  id: number;
  asset_tag: string | null;
  name: string;
  description: string;
  category: number;
  category_detail: ApiAssetCategory | null;
  vendor: number | null;
  vendor_detail: ApiAssetVendor | null;
  brand: string;
  model: string;
  serial_number: string;
  status: Asset['status'];
  condition: NonNullable<Asset['condition']>;
  location: string;
  purchase_price: string | null;
  purchase_date: string | null;
  supplier: string;
  invoice_number: string;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  notes: string;
  is_critical: boolean;
  created_at: string;
  updated_at: string;
}

const transformApiAsset = (apiAsset: ApiAsset): Asset => ({
  id: String(apiAsset.id),
  asset_tag: apiAsset.asset_tag ?? undefined,
  name: apiAsset.name,
  description: apiAsset.description,
  category: {
    id: String(apiAsset.category_detail?.id ?? apiAsset.category),
    name: apiAsset.category_detail?.name ?? '',
    description: apiAsset.category_detail?.description,
    created_at: apiAsset.category_detail?.created_at ?? '',
    updated_at: apiAsset.category_detail?.updated_at ?? '',
  },
  vendor: apiAsset.vendor_detail
    ? {
        id: String(apiAsset.vendor_detail.id),
        name: apiAsset.vendor_detail.name,
        created_at: apiAsset.vendor_detail.created_at,
        updated_at: apiAsset.vendor_detail.updated_at,
      }
    : undefined,
  brand: apiAsset.brand,
  model: apiAsset.model,
  serial_number: apiAsset.serial_number,
  status: apiAsset.status,
  condition: apiAsset.condition,
  location: apiAsset.location,
  purchase_price: apiAsset.purchase_price != null ? Number(apiAsset.purchase_price) : undefined,
  purchase_date: apiAsset.purchase_date ?? undefined,
  supplier: apiAsset.supplier,
  invoice_number: apiAsset.invoice_number,
  warranty_start_date: apiAsset.warranty_start_date ?? undefined,
  warranty_end_date: apiAsset.warranty_end_date ?? undefined,
  last_maintenance: apiAsset.last_maintenance ?? undefined,
  next_maintenance: apiAsset.next_maintenance ?? undefined,
  notes: apiAsset.notes,
  is_critical: apiAsset.is_critical,
  created_at: apiAsset.created_at,
  updated_at: apiAsset.updated_at,
});

export interface AssetListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Asset[];
}

export interface AssetListParams {
  search: string;
  status: string;
  page: number;
  pageSize: number;
}

interface ApiAssetListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiAsset[];
}

const fetchAssets = async (params: AssetListParams, signal?: AbortSignal): Promise<AssetListResponse> => {
  const response = await http.get<ApiAssetListResponse>(APIS.ASSET_MANAGEMENT_ASSETS, {
    params: {
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    signal,
  });
  return { ...response.data, results: response.data.results.map(transformApiAsset) };
};

export const useAssetsQuery = (params: AssetListParams) =>
  useQuery<AssetListResponse>({
    queryKey: ['assets', params],
    queryFn: ({ signal }) => fetchAssets(params, signal),
    placeholderData: (prev) => prev,
  });

export interface AssetFormValues {
  name: string;
  description: string;
  asset_tag: string;
  serial_number: string;
  category: string;
  vendor: string;
  brand: string;
  model: string;
  status: Asset['status'];
  condition: NonNullable<Asset['condition']>;
  location: string;
  purchase_price: string;
  purchase_date: string;
  supplier: string;
  invoice_number: string;
  warranty_start_date: string;
  warranty_end_date: string;
  last_maintenance: string;
  next_maintenance: string;
  notes: string;
  is_critical: boolean;
}

export const EMPTY_ASSET_FORM_VALUES: AssetFormValues = {
  name: '',
  description: '',
  asset_tag: '',
  serial_number: '',
  category: '',
  vendor: '',
  brand: '',
  model: '',
  status: 'available',
  condition: 'good',
  location: '',
  purchase_price: '',
  purchase_date: '',
  supplier: '',
  invoice_number: '',
  warranty_start_date: '',
  warranty_end_date: '',
  last_maintenance: '',
  next_maintenance: '',
  notes: '',
  is_critical: false,
};

export const assetToFormValues = (asset: Asset): AssetFormValues => ({
  name: asset.name,
  description: asset.description ?? '',
  asset_tag: asset.asset_tag ?? '',
  serial_number: asset.serial_number ?? '',
  category: asset.category ? String(asset.category.id) : '',
  vendor: asset.vendor ? String(asset.vendor.id) : '',
  brand: asset.brand ?? '',
  model: asset.model ?? '',
  status: asset.status,
  condition: asset.condition ?? 'good',
  location: asset.location ?? '',
  purchase_price: asset.purchase_price != null ? String(asset.purchase_price) : '',
  purchase_date: asset.purchase_date ?? '',
  supplier: asset.supplier ?? '',
  invoice_number: asset.invoice_number ?? '',
  warranty_start_date: asset.warranty_start_date ?? '',
  warranty_end_date: asset.warranty_end_date ?? '',
  last_maintenance: asset.last_maintenance ?? '',
  next_maintenance: asset.next_maintenance ?? '',
  notes: asset.notes ?? '',
  is_critical: asset.is_critical,
});

const toPayload = (values: AssetFormValues) => ({
  name: values.name,
  description: values.description,
  asset_tag: values.asset_tag || null,
  serial_number: values.serial_number,
  category: values.category,
  vendor: values.vendor || null,
  brand: values.brand,
  model: values.model,
  status: values.status,
  condition: values.condition,
  location: values.location,
  purchase_price: values.purchase_price ? Number(values.purchase_price) : null,
  purchase_date: values.purchase_date || null,
  supplier: values.supplier,
  invoice_number: values.invoice_number,
  warranty_start_date: values.warranty_start_date || null,
  warranty_end_date: values.warranty_end_date || null,
  last_maintenance: values.last_maintenance || null,
  next_maintenance: values.next_maintenance || null,
  notes: values.notes,
  is_critical: values.is_critical,
});

const createAsset = async (values: AssetFormValues): Promise<Asset> => {
  const response = await http.post<ApiAsset>(APIS.ASSET_MANAGEMENT_ASSETS, toPayload(values));
  return transformApiAsset(response.data);
};

const updateAsset = async ({ id, values }: { id: string; values: AssetFormValues }): Promise<Asset> => {
  const response = await http.put<ApiAsset>(`${APIS.ASSET_MANAGEMENT_ASSETS}${id}/`, toPayload(values));
  return transformApiAsset(response.data);
};

const deleteAsset = async (id: string): Promise<void> => {
  await http.delete(`${APIS.ASSET_MANAGEMENT_ASSETS}${id}/`);
};

const bulkDeleteAssets = async (ids: string[]): Promise<void> => {
  await http.post(`${APIS.ASSET_MANAGEMENT_ASSETS}destroy-multiple/`, { ids });
};

export const useCreateAssetMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAsset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });
};

export const useUpdateAssetMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAsset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });
};

export const useDeleteAssetMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });
};

export const useBulkDeleteAssetsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkDeleteAssets,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });
};
