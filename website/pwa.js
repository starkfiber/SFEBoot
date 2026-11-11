if('serviceWorker' in navigator){navigator.serviceWorker.register(new URL('sw.js',document.currentScript.src)).catch(()=>{});}
