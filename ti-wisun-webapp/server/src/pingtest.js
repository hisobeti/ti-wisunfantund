const {exec} = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function validateInterface(interfaceName) {
  try {
    const {stdout: ifconfigOutput} = await execPromise('ifconfig');
    return ifconfigOutput.includes(interfaceName);
  } catch (error) {
    throw new Error(`Failed to validate interface: ${error.message}`);
  }
}

async function pingDevice(interface, ipAddress) {
  try {
    // Validate interface first
    const isValid = await validateInterface(interface);
    if (!isValid) {
      return {
        success: false,
        error: `Interface "${interface}" not found`,
      };
    }

    const startTime = Date.now();
    const {stdout, stderr} = await execPromise(
      `ping6 -I ${interface} -c 1 ${ipAddress}`
    );
    const endTime = Date.now();
    
    const latencyMatch = stdout.match(/time=([\d.]+) ms/);
    const latency = latencyMatch ? parseFloat(latencyMatch[1]) : endTime - startTime;

    return {
      success: true,
      latency,
      output: stdout,
    };
  } catch (error) {
    return {
      success: false,
      latency: null,
      error: error.message,
    };
  }
}

module.exports = {pingDevice, validateInterface};
