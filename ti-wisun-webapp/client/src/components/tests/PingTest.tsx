import React, {useState, useEffect, useContext} from 'react';
import {AppContext} from '../../Contexts';
import {PingStats} from '../../types/test-types';

interface PingTestSettings {
  interfaceName: string;
  packetSize: number;
  interval: number;
  testTime: number;
  isInfiniteTest: boolean;
}

const PingTest: React.FC = () => {
  const appContext = useContext(AppContext);
  const connectedDevices = appContext?.state.topology.connectedDevices || [];

  const [settings, setSettings] = useState<PingTestSettings>({
    interfaceName: '',
    packetSize: 50,     // default 50 bytes
    interval: 1,        // default 1 second
    testTime: 3600,     // default 1 hour (3600 seconds)
    isInfiniteTest: false,
  });

  const [isStarting, setIsStarting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pingStats, setPingStats] = useState<PingStats[]>([]);
  const [testInterval, setTestInterval] = useState<NodeJS.Timeout | null>(null);
  const [interfaceError, setInterfaceError] = useState<string | null>(null);
  const [testTimeout, setTestTimeout] = useState<NodeJS.Timeout | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [testEnded, setTestEnded] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (testInterval) {
        clearInterval(testInterval);
      }
      if (testTimeout) {
        clearTimeout(testTimeout);
      }
    };
  }, [testInterval, testTimeout]);

  // Separate useEffect for countdown timer
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;

    if (isRunning && !settings.isInfiniteTest) {
      setRemainingTime(settings.testTime);
      timerInterval = setInterval(() => {
        setRemainingTime(prev => {
          if (prev === null || prev <= 0) return 0;
          return prev - 1;
        });
      }, 1000);
    } else {
      setRemainingTime(null);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isRunning, settings.isInfiniteTest, settings.testTime]);

  const startPingTest = async () => {
    // Initialize stats for each device with new latency fields
    const initialStats: PingStats[] = connectedDevices.map(ip => ({
      ipAddress: ip,
      totalPings: 0,
      successful: 0,
      failed: 0,
      lastFailedAt: null,
      totalLatency: 0,
      avgLatency: null,
    }));
    setPingStats(initialStats);

    let shouldContinue = true;
    const startTime = Date.now();
    let currentNodeIndex = 0;

    // Start the ping interval - now pinging one node at a time
    const interval = setInterval(async () => {
      // Check if we should stop based on test time
      if (!settings.isInfiniteTest && 
          (Date.now() - startTime) >= settings.testTime * 1000 && 
          shouldContinue) {
        shouldContinue = false;
        stopPingTest();
        setIsRunning(false);
        return;
      }

      // Continue with pings if we should
      if (shouldContinue && connectedDevices.length > 0) {
        const ip = connectedDevices[currentNodeIndex];
        
        try {
          const response = await fetch('/api/ping', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              interface: settings.interfaceName,
              ipAddress: ip,
            }),
          });

          const result = await response.json();

          setPingStats(prevStats => {
            return prevStats.map(stat => {
              if (stat.ipAddress === ip) {
                const newSuccessful = stat.successful + (result.success ? 1 : 0);
                const newTotalLatency = result.success 
                  ? stat.totalLatency + result.latency 
                  : stat.totalLatency;
                
                return {
                  ...stat,
                  totalPings: stat.totalPings + 1,
                  successful: newSuccessful,
                  failed: stat.failed + (result.success ? 0 : 1),
                  lastFailedAt: result.success ? stat.lastFailedAt : stat.totalPings + 1,
                  totalLatency: newTotalLatency,
                  avgLatency: newSuccessful > 0 ? newTotalLatency / newSuccessful : null,
                };
              }
              return stat;
            });
          });
        } catch (error) {
          console.error(`Error pinging ${ip}:`, error);
        }

        // Move to next node
        currentNodeIndex = (currentNodeIndex + 1) % connectedDevices.length;
      }
    }, settings.interval * 1000);

    setTestInterval(interval);
  };

  const stopPingTest = () => {
    if (testInterval) {
      clearInterval(testInterval);
      setTestInterval(null);
    }
    setTestEnded(true);
  };

  const validateAndStartTest = async () => {
    try {
      const response = await fetch('/api/validate-interface', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interface: settings.interfaceName,
        }),
      });

      const {isValid, error} = await response.json();
      
      if (!isValid) {
        setInterfaceError(error || 'Invalid interface');
        setIsStarting(false);
        return false;
      }
      
      setInterfaceError(null);
      return true;
    } catch (error) {
      setInterfaceError('Failed to validate interface');
      setIsStarting(false);
      return false;
    }
  };

  const handleStartStop = () => {
    if (!isRunning) {
      setTestEnded(false);
      setIsStarting(true);
      validateAndStartTest().then(isValid => {
        if (isValid) {
          setTimeout(() => {
            setIsStarting(false);
            setIsRunning(true);
            startPingTest();
          }, 3000);
        }
      });
    } else {
      setIsRunning(false);
      stopPingTest();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {name, value, type, checked} = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              name === 'interfaceName' ? value : 
              Number(value),
    }));
  };

  const generateCSV = () => {
    // CSV header
    const headers = [
      'Node Number',
      'IP Address',
      'Total Pings',
      'Successful Pings',
      'Failed Pings',
      'Last Failed Ping Count',
      'Average Latency (ms)'
    ].join(',');

    // CSV data rows
    const rows = pingStats.map((stat, index) => [
      index + 1, // Node Number
      stat.ipAddress,
      stat.totalPings,
      stat.successful,
      stat.failed,
      stat.lastFailedAt || 'N/A',
      stat.avgLatency ? stat.avgLatency.toFixed(2) : 'N/A'
    ].join(','));

    // Combine headers and rows
    const csvContent = [headers, ...rows].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ping_test_results_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="test-window">
      <h2>Ping Test</h2>
      <div className="ping-test-form">
        <div className="form-controls">
          <div className="form-group">
            <label htmlFor="interfaceName">Interface Name:</label>
            <input
              type="text"
              id="interfaceName"
              name="interfaceName"
              value={settings.interfaceName}
              onChange={handleInputChange}
              placeholder="Enter interface name"
              className={interfaceError ? 'error' : ''}
              disabled={isRunning || isStarting}
            />
            {interfaceError && (
              <div className="error-message">{interfaceError}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="packetSize">
              Packet Size (bytes): {settings.packetSize}
            </label>
            <input
              type="range"
              id="packetSize"
              name="packetSize"
              min="1"
              max="1000"
              value={settings.packetSize}
              onChange={handleInputChange}
              disabled={isRunning || isStarting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="interval">
              Interval (seconds): {settings.interval}
            </label>
            <input
              type="range"
              id="interval"
              name="interval"
              min="1"
              max="100"
              value={settings.interval}
              onChange={handleInputChange}
              disabled={isRunning || isStarting}
            />
          </div>

          <div className="form-group">
            <div className="test-time-header">
              <label htmlFor="testTime">
                Test Time (seconds): {settings.isInfiniteTest ? "∞" : settings.testTime}
              </label>
              <div className="infinite-test-checkbox">
                <input
                  type="checkbox"
                  id="isInfiniteTest"
                  name="isInfiniteTest"
                  checked={settings.isInfiniteTest}
                  onChange={handleInputChange}
                  disabled={isRunning || isStarting}
                />
                <label htmlFor="isInfiniteTest">Run until stopped</label>
              </div>
            </div>
            <input
              type="range"
              id="testTime"
              name="testTime"
              min="1"
              max="7200"
              value={settings.testTime}
              onChange={handleInputChange}
              disabled={isRunning || isStarting || settings.isInfiniteTest}
            />
          </div>
        </div>

        <div className="ping-stats-section">
          <h3>Ping Statistics</h3>
          <div className="table-container">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Node #</th>
                  <th>IP Address</th>
                  <th>Total</th>
                  <th>Success</th>
                  <th>Failed</th>
                  <th>Success Rate</th>
                  <th>Last Fail #</th>
                  <th>Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {pingStats.map((stat, index) => {
                  const successRate = stat.totalPings > 0 
                    ? ((stat.successful / stat.totalPings) * 100).toFixed(1) 
                    : '0.0';
                  
                  return (
                    <tr key={stat.ipAddress}>
                      <td className="numeric-cell">{index + 1}</td>
                      <td className="ip-cell">{stat.ipAddress}</td>
                      <td className="numeric-cell">{stat.totalPings}</td>
                      <td className="numeric-cell">{stat.successful}</td>
                      <td className="numeric-cell">{stat.failed}</td>
                      <td className="numeric-cell">{successRate}%</td>
                      <td className="numeric-cell">
                        {stat.lastFailedAt || '-'}
                      </td>
                      <td className="numeric-cell">
                        {stat.avgLatency ? `${stat.avgLatency.toFixed(2)}ms` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="button-container">
          <button
            className={`test-button ${isRunning ? 'stop' : 'start'} ${
              isStarting ? 'starting' : ''
            }`}
            onClick={handleStartStop}
            disabled={!settings.interfaceName || isStarting}
          >
            {isStarting ? 'Starting Test' : isRunning ? 'Stop Test' : 'Start Test'}
          </button>

          {testEnded && pingStats.length > 0 && (
            <button
              className="download-button"
              onClick={generateCSV}
            >
              Download Results
            </button>
          )}
        </div>

        {/* Add countdown timer display */}
        {isRunning && (
          <div className="countdown-timer">
            {settings.isInfiniteTest ? (
              'Test will run until manually stopped'
            ) : remainingTime !== null ? (
              `Time remaining: ${Math.floor(remainingTime / 60)}:${(remainingTime % 60)
                .toString()
                .padStart(2, '0')}`
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default PingTest; 