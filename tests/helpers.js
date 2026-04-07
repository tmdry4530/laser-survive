export function createIndexedDbMock() {
  class FakeRequest {
    constructor(transaction, executor) {
      this.onsuccess = null;
      this.onerror = null;
      transaction?.track();
      queueMicrotask(() => {
        try {
          const result = executor();
          this.result = result;
          this.onsuccess?.({ target: this });
          transaction?.finish();
        } catch (error) {
          this.error = error;
          this.onerror?.({ target: this });
          transaction?.fail(error);
        }
      });
    }
  }

  class FakeTransaction {
    constructor(storeData) {
      this.storeData = storeData;
      this.pending = 0;
      this.completed = false;
      this.error = null;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;
      this.completeTimer = null;
    }

    track() {
      this.pending += 1;
      if (this.completeTimer) {
        clearTimeout(this.completeTimer);
        this.completeTimer = null;
      }
    }

    finish() {
      this.pending -= 1;
      if (this.pending === 0 && !this.completed) {
        this.completeTimer = setTimeout(() => {
          if (this.pending === 0 && !this.completed && !this.error) {
            this.completed = true;
            this.oncomplete?.({ target: this });
          }
        }, 0);
      }
    }

    fail(error) {
      this.error = error;
      this.onerror?.({ target: this });
      this.onabort?.({ target: this });
    }

    objectStore() {
      return {
        get: (id) => new FakeRequest(this, () => this.storeData.get(id)),
        put: ({ id, value }) => new FakeRequest(this, () => {
          this.storeData.set(id, { id, value });
          return { id, value };
        }),
      };
    }
  }

  class FakeDatabase {
    constructor() {
      this.storeData = new Map();
      this.objectStoreNames = {
        contains: (name) => name === 'records',
      };
    }

    createObjectStore() {
      return null;
    }

    transaction() {
      return new FakeTransaction(this.storeData);
    }

    close() {}
  }

  const database = new FakeDatabase();

  return {
    open() {
      const request = {
        result: database,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };

      queueMicrotask(() => {
        request.onupgradeneeded?.({ target: request });
        request.onsuccess?.({ target: request });
      });

      return request;
    },
    __database: database,
  };
}

export function createCanvasContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillRect() {},
    beginPath() {},
    closePath() {},
    rect() {},
    fill() {},
    stroke() {},
    arc() {},
    moveTo() {},
    lineTo() {},
    createLinearGradient() {
      return {
        addColorStop() {},
      };
    },
  };
}
