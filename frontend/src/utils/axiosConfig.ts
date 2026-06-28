// DEPRECATED: This file previously registered a global axios interceptor that
// duplicated the logic in src/services/http.ts. The interceptor has been removed
// to avoid running two different auth flows on every request.
//
// All authenticated requests must go through the `http` instance exported from
// src/services/http.ts. Do not import this file.
export {};
