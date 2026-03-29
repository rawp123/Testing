const { sendCurrentState } = require('./_shared');

module.exports = async function handler(_req, res) {
  await sendCurrentState(res);
};
