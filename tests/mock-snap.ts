// @ts-ignore
global.snap = new class {
  state: string | null = null;
  request = async ({
                     method ='snap_manageState',
                     params: { operation = 'clear', newState = '' },
                   }) => {
    switch (operation) {
      case 'clear':
        this.state = null;
        break;
      case 'get':
        break;
      case 'update':
        this.state = newState;
        break;
    }
    return this.state;
  }
};
