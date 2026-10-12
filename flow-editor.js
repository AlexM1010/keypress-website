    const workspace = document.getElementById('workspace');
    const tour = new URL(location.href).searchParams.has('tour');
    if (tour) {
      const url = new URL(workspace.src); url.searchParams.set('tour', '1'); workspace.src = url.href;
      addEventListener('message', event => {
        if (event.origin !== location.origin || event.data?.channel !== 'keypress-tour') return;
        if (event.source === workspace.contentWindow && ['ready','started','progress','action','finished','stopped','error'].includes(event.data.type))
          parent.postMessage(event.data, location.origin);
        if (event.source === parent && ['stop','ack'].includes(event.data.type))
          workspace.contentWindow.postMessage(event.data, location.origin);
      });
    }
    function resizeWorkspace() {
      const scale = Math.min(1, innerWidth / 1600);
      workspace.style.width = innerWidth / scale + 'px';
      workspace.style.height = innerHeight / scale + 'px';
      workspace.style.transform = 'scale(' + scale + ')';
    }
    addEventListener('resize', resizeWorkspace);
    resizeWorkspace();
