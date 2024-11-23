!(function (t) {
  const e = new WeakMap(),
    n = (t, e, n) =>
      new Promise((o) => {
        const s = () => {
          t.removeEventListener("transitionend", s), o();
        };
        (t.style[e] = n), t.addEventListener("transitionend", s);
      }),
    o = (t) => n(t, "opacity", 0),
    s = (t) => n(t, "opacity", 1),
    i = (t) =>
      ((t) => new Promise((e) => setTimeout(e, t)))(1e3)
        .then(() => o(t))
        .then(() => {
          const n = e.get(t);
          return (t[n.prop] = n.contents.shift()), s(t);
        })
        .then(() =>
          e.get(t).contents.length
            ? i(t)
            : ((t) => {
                e.get(t).timer = null;
              })(t),
        );
  t.smoothly = (t, n, r) => {
    ((t, n) => {
      e.has(t) || (t.style.transition = n);
    })(t, "all 0.5s ease-in-out"),
      e.has(t) || e.set(t, { prop: n, contents: [], timer: null });
    const c = e.get(t);
    c.contents.push(r),
      c.timer ||
        (c.timer = setTimeout(() => {
          if (c.contents.length > 1) return i(t);
          (c.timer = null),
            ((t) =>
              o(t).then(() => {
                const n = e.get(t);
                return (t[n.prop] = n.contents.shift()), s(t);
              }))(t);
        }, 0));
  };
})(window);
