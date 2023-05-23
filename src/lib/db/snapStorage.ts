const getAll = async () => {
  return await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  });
};

export const getItem = async (key: string): Promise<any> => {
  const data = await getAll();
  return data ? data[key] || null : null;
};

export const setItem = async (key: string, inputData: string) => {
  const state = (await getAll()) ?? {};
  state[key] = inputData;
  return await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: state },
  });
};

export const clear = async () => {
  return await snap.request({
    method: 'snap_manageState',
    params: { operation: 'clear' },
  });
};

export const snapStorage = {
  getAll,
  getItem,
  setItem,
  clear,
};
