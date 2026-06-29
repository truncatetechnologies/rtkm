"use client";
// Thin SWR wrapper over the existing api() fetcher. Pass `null` as key to skip fetching
// (e.g. before a transport is selected). Returns SWR's { data, error, isLoading, mutate, ... }.
import useSWR from "swr";
import { api } from "./clientApi";

const fetcher = (path) => api(path);

export function useApi(key, options) {
  return useSWR(key, fetcher, options);
}
