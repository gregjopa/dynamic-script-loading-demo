function route(app) {
  app.get('/', (req, res) => {
    return res.render('index');
  });

  app.get('/paypal-js-defer-test', (req, res) => {
    return res.render('paypal-js-defer-test');
  });

  app.get('/no-dynamic-loading', (req, res) => {
    return res.render('no-dynamic-loading');
  });

  app.get('/partial-dynamic-loading', (req, res) => {
    return res.render('partial-dynamic-loading');
  });

  app.get('/dynamic-loading', (req, res) => {
    return res.render('dynamic-loading');
  });


  app.get('/slow-script', (req, res) => {
    res.set('Content-Type', 'text/javascript');

    setTimeout(function () {
      return res.send(`console.log('slow script response')`);
    }, 10000);
  });

  app.get('/fast-script', (req, res) => {
    res.set('Content-Type', 'text/javascript');

    setTimeout(function () {
      return res.send(`
        console.log('response from /fast-script/');
        if (window.init) {
          window.init();
        }
      `);
    }, 1000);

  });
}

module.exports = route;
