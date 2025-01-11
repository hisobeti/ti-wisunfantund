import React, {useState} from 'react';
import Select from 'react-select';
import {TestType, TEST_OPTIONS} from '../types/test-types';
import PingTest from './tests/PingTest';

const TestPage: React.FC = () => {
  const [selectedTest, setSelectedTest] = useState<TestType | null>(null);

  const handleTestSelect = (option: any) => {
    setSelectedTest(option?.value || null);
  };

  const renderTestWindow = () => {
    switch (selectedTest) {
      case TestType.PING_TEST:
        return <PingTest />;
      default:
        return null;
    }
  };

  const selectOptions = TEST_OPTIONS.map(option => ({
    value: option.type,
    label: option.label,
  }));

  return (
    <div className="test-page">
      <div className="test-selector">
        <h2>Select Test</h2>
        <Select
          options={selectOptions}
          onChange={handleTestSelect}
          placeholder="Choose a test..."
          isClearable
          className="test-select"
        />
      </div>
      {selectedTest && (
        <div className="test-description">
          <p>
            {TEST_OPTIONS.find(option => option.type === selectedTest)?.description}
          </p>
        </div>
      )}
      <div className="test-content">
        {renderTestWindow()}
      </div>
    </div>
  );
};

export default TestPage; 