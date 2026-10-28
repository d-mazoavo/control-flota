/* Copia local en el navegador (IndexedDB): evita descargar de nuevo lo que no ha cambiado. */
(function () {
  'use strict';
  var FL = (window.FL = window.FL || {});
  var DB = 'avopak-flota', ST = 'kv', dbp = null;
  var mem = {};   // respaldo en memoria si el navegador no permite IndexedDB (ventana privada)

  function abrir() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(modo, fn) {
    return abrir().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, modo), s = t.objectStore(ST), out;
        var r = fn(s);
        if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  FL.Store = {
    get: function (k) { return tx('readonly', function (s) { return s ? s.get(k) : null; }).then(function (v) { return v === undefined || v === null ? (mem[k] === undefined ? null : mem[k]) : v; }).catch(function () { return mem[k] || null; }); },
    set: function (k, v) { mem[k] = v; return tx('readwrite', function (s) { return s ? s.put(v, k) : null; }).catch(function () { }); },
    del: function (k) { delete mem[k]; return tx('readwrite', function (s) { return s ? s.delete(k) : null; }).catch(function () { }); },
    limpiar: function () { mem = {}; return tx('readwrite', function (s) { return s ? s.clear() : null; }).catch(function () { }); }
  };
})();
