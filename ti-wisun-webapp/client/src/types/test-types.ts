export enum TestType {
  PING_TEST = 'Ping Test',
  // Add more test types here in the future
}

export interface TestOption {
  type: TestType;
  label: string;
  description: string;
}

export const TEST_OPTIONS: TestOption[] = [
  {
    type: TestType.PING_TEST,
    label: 'Ping Test',
    description: 'Test network connectivity and latency between nodes. The Border Router will ping each router node in the network.',
  },
  // Add more test options here in the future
];

export interface PingStats {
  ipAddress: string;
  totalPings: number;
  successful: number;
  failed: number;
  lastFailedAt: number | null;
  totalLatency: number;  // Sum of all latencies
  avgLatency: number | null;  // Average latency
} 