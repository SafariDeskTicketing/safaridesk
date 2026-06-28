import { APIS } from "./apis";
import http from "./http";

export const login = async (payload: object) => {
    try {
        const response = await http.post(APIS.LOGIN, payload);
        return response.data;
    } catch (error) {
        throw error;
    }
};


export const expressLogin = async (payload: object) => {
    try {
        const response = await http.post(APIS.EXPRESS_LOGIN, payload);
        return response.data;
    } catch (error) {
        throw error;
    }
};
