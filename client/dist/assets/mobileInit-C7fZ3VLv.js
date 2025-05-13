const d=()=>{if(typeof window>"u")return;const e=window.innerHeight*.01;document.documentElement.style.setProperty("--vh",`${e}px`),document.documentElement.style.setProperty("--window-width",`${window.innerWidth}px`),document.documentElement.style.setProperty("--window-height",`${window.innerHeight}px`),document.documentElement.style.setProperty("--device-pixel-ratio",window.devicePixelRatio)},a=()=>{if(typeof window>"u"||typeof document>"u")return;const e=navigator.userAgent||navigator.vendor||window.opera,t=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(e)||window.innerWidth<768,n="ontouchstart"in window||navigator.maxTouchPoints>0||navigator.msMaxTouchPoints>0,o=/iPad|iPhone|iPod/.test(e)&&!window.MSStream,c=/android/i.test(e),l=/XiaoMi|MI|Redmi/i.test(e),m=/POCO/i.test(e),w=/MIUI/i.test(e),u=/Samsung/i.test(e),p=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone||document.referrer.includes("android-app://"),s=document.documentElement,i=document.body;["mobile-view","desktop-view","mobile-device","desktop-device","touch-device","ios-device","android-device","pwa-mode","landscape","portrait","xiaomi-device","poco-device","miui-browser","samsung-device"].forEach(r=>{s.classList.remove(r),i.classList.remove(r)}),t?(s.classList.add("mobile-view"),i.classList.add("mobile-device")):(s.classList.add("desktop-view"),i.classList.add("desktop-device")),n&&i.classList.add("touch-device"),o&&i.classList.add("ios-device"),c&&i.classList.add("android-device"),p&&i.classList.add("pwa-mode"),l&&i.classList.add("xiaomi-device"),m&&i.classList.add("poco-device"),w&&i.classList.add("miui-browser"),u&&i.classList.add("samsung-device"),window.matchMedia("(orientation: landscape)").matches?i.classList.add("landscape"):i.classList.add("portrait")},v=()=>{if(typeof document>"u")return;const e=document.querySelector('meta[name="viewport"]');if(e)e.content="width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, viewport-fit=cover";else{const n=document.createElement("meta");n.name="viewport",n.content="width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, viewport-fit=cover",document.head.appendChild(n)}const t=document.createElement("style");t.textContent=`
    /* iOS specific form input sizing */
    @supports (-webkit-touch-callout: none) {
      input, textarea, select {
        font-size: 16px !important;
      }
    }
    
    /* General mobile fixes */
    .mobile-device input,
    .mobile-device textarea, 
    .mobile-device select {
      font-size: 16px !important;
    }
    
    /* Fix for vh units on mobile */
    .mobile-device .fullheight {
      height: 100vh; /* Fallback */
      height: calc(var(--vh, 1vh) * 100); /* Use the custom property */
    }
    
    /* Xiaomi/MIUI specific adjustments */
    .xiaomi-device input, 
    .xiaomi-device textarea, 
    .xiaomi-device select,
    .poco-device input,
    .poco-device textarea,
    .poco-device select {
      font-size: 16px !important;
      -webkit-appearance: none;
    }
    
    /* Fix for input focus issues on Xiaomi/Poco */
    .xiaomi-device input:focus,
    .poco-device input:focus {
      transform: translateY(0);
    }
    
    /* Samsung specific fixes */
    .samsung-device .fullheight {
      height: calc(var(--vh, 1vh) * 100); 
    }
  `,document.head.appendChild(t),document.addEventListener("touchend",function(n){const o=Date.now();this.lastTouchEnd&&o-this.lastTouchEnd<300&&n.preventDefault(),this.lastTouchEnd=o},!1)},h=()=>{if(typeof window>"u"||typeof document>"u")return;const e=()=>{const t=document.body;window.matchMedia("(orientation: landscape)").matches||window.innerWidth>window.innerHeight||window.orientation!==void 0&&(window.orientation===90||window.orientation===-90)?(t.classList.remove("portrait"),t.classList.add("landscape")):(t.classList.remove("landscape"),t.classList.add("portrait")),d()};window.addEventListener("orientationchange",e),window.addEventListener("resize",e),e(),setTimeout(e,300)},g=()=>{d(),a(),v(),h(),document.readyState==="loading"&&document.addEventListener("DOMContentLoaded",()=>{d(),a()}),window.addEventListener("load",()=>{d(),a()});const e=navigator.userAgent||navigator.vendor||window.opera;return{isMobile:/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(e)||window.innerWidth<768,isIOS:/iPad|iPhone|iPod/.test(e)&&!window.MSStream,isAndroid:/android/i.test(e),isXiaomi:/XiaoMi|MI|Redmi/i.test(e),isPoco:/POCO/i.test(e),isSamsung:/Samsung/i.test(e),width:window.innerWidth,height:window.innerHeight,pixelRatio:window.devicePixelRatio,orientation:window.matchMedia("(orientation: landscape)").matches?"landscape":"portrait"}};export{a as detectDevice,v as enablePinchZoom,h as handleOrientationChange,g as initializeMobileOptimizations,d as setViewportHeight};
//# sourceMappingURL=mobileInit-C7fZ3VLv.js.map
