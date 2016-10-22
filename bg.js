// vi:ts=2 sw=2 et
'use strict';

let c = (source => {
  function setDeep(obj, path, val) {
    if (path.length == 1) {
      obj[path[0]] = val;
    } else if (path.length > 0) {
      let n = path.shift();
      obj[n] || (obj[n] = {});
      setDeep(obj[n], path, val);
    } else {
      throw Error();
    }
  }

  function makeWrapper(f) {
    return (...a)=>new Promise((v,j)=>f(...a,x=>(e=>e?j(Error(e.message)):v(x))(chrome.runtime.lastError)));
  }

  let target = {};
  (function walk(obj, visitor, path) {
    for (let x of Object.entries(obj)){
      let k = x[0];
      let v = x[1];
      let t = typeof v;
      switch (t) {
        case "object":
          let path_ = [...path];
          path_.push(k);
          walk(v, visitor, path_);
          break;
        default:
          if (t in visitor) {
            visitor[t](path, k, v);
          }
      }
    }
  })(source, {
    'function': (path, k, v) => {
      setDeep(target, path.concat(k), makeWrapper(v));
    }
  }, []);
  return target;
})(chrome);



async function discardMany() {
  let tabs = await c.tabs.query(
      {discarded:false, autoDiscardable:true, active:false});
  let discarded = [];
  for (let t of tabs) {
    try {
      await c.tabs.discard(t.id);
    } catch (e) {
      console.error(e);
      continue;
    }
    discarded.push(t.id);
  }
  return discarded;
}

async function onBrowserActionClicked() {
  chrome.browserAction.setBadgeText({'text':'…'});
  let result = await discardMany();
  await recordResult(result);
  await showBadge();
}

async function getCount() {
  let val = (await c.storage.sync.get({'count': 0})).count;
  if (typeof val != "number") {
    val = +val;
  }
  if (!Number.isFinite(val)) {
    val = 0;
  }
  return val;
}

async function recordResult(result) {
  let count = result.length;
  let old_val = await getCount();
  let new_val = old_val + count;
  await c.storage.sync.set({'count': new_val});
  return new_val;
}

async function showBadge() {
  let val = '' + await getCount();
  chrome.browserAction.setBadgeText({'text':val});
}

chrome.browserAction.onClicked.addListener(onBrowserActionClicked);
showBadge();
