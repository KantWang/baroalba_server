module.exports = {
  apps: [{
  name: 'myapp',
  script: './index.js',
  instances: 0,
  exec_mode: 'cluster'
  }]
}
