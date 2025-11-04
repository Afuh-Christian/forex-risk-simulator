import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Zap, TrendingUp, DollarSign, Repeat, Target, Moon, Sun, Table2, Trash2 } from 'lucide-react';
import { useFormik, FormikProps } from 'formik'; // Import FormikProps for component typing
import * as Yup from 'yup';
import { LucideIcon } from 'lucide-react'; // Type for Lucide icons

// --- TypeScript Interfaces and Types ---

interface FieldLimitConfig {
  min: number;
  max: number;
  step: number;
  label: string;
  icon: LucideIcon; // Using LucideIcon type for the component
  unit: string;
}

interface FieldLimits {
  startBalance: FieldLimitConfig;
  riskPerTrade: FieldLimitConfig;
  rrRatio: FieldLimitConfig;
  numTrades: FieldLimitConfig;
  winRate: FieldLimitConfig;
}

interface FormValues {
  startBalance: number;
  riskPerTrade: number;
  rrRatio: number;
  numTrades: number;
  winRate: number;
}

interface TradeHistoryItem {
  trade: number;
  balance: number;
  isWin?: boolean; // True for win, false for loss. Undefined/false for trade 0.
}

interface WinRateOutcome {
  winRate: number;
  finalBalance: number;
  isBreakEven: boolean;
}

interface SimulationResultsState {
  finalBalance: number;
  tradeHistory: TradeHistoryItem[];
  winRateOutcomes: WinRateOutcome[];
}

// --- Configuration & Validation ---

const FIELD_LIMITS: FieldLimits = {
  startBalance: { min: 10, max: 10000, step: 100, label: 'Starting Balance', icon: DollarSign, unit: '$' },
  riskPerTrade: { min: 0.5, max: 45, step: 0.1, label: 'Risk Per Trade', icon: Target, unit: '%' },
  rrRatio: { min: 0.5, max: 20, step: 0.1, label: 'Reward-to-Risk Ratio', icon: TrendingUp, unit: '' },
  numTrades: { min: 10, max: 1000, step: 10, label: 'Number of Trades', icon: Repeat, unit: '' },
  winRate: { min: 1, max: 99, step: 0.5, label: 'Win Rate', icon: Target, unit: '%' },
};

const validationSchema = Yup.object().shape({
  startBalance: Yup.number().typeError('Must be a number').required('Required').min(FIELD_LIMITS.startBalance.min).max(FIELD_LIMITS.startBalance.max),
  riskPerTrade: Yup.number().typeError('Must be a number').required('Required').min(FIELD_LIMITS.riskPerTrade.min).max(FIELD_LIMITS.riskPerTrade.max),
  rrRatio: Yup.number().typeError('Must be a number').required('Required').min(FIELD_LIMITS.rrRatio.min).max(FIELD_LIMITS.rrRatio.max),
  numTrades: Yup.number().typeError('Must be an integer').required('Required').min(FIELD_LIMITS.numTrades.min).max(FIELD_LIMITS.numTrades.max).integer(),
  winRate: Yup.number().typeError('Must be a number').required('Required').min(FIELD_LIMITS.winRate.min).max(FIELD_LIMITS.winRate.max),
});

// --- Helper Functions ---

/**
 * Calculates the break-even win rate based on the Reward-to-Risk Ratio (RR).
 */
const calculateBreakEvenRate = (rrRatio: number): number => {
  if (rrRatio <= 0) return 100;
  return (1 / (rrRatio + 1)) * 100;
};

/**
 * Simulates the account balance over a specified number of trades.
 */
const simulateTrades = (
  startBalance: number,
  riskPerTrade: number,
  rrRatio: number,
  numTrades: number,
  winRate: number
): { finalBalance: number, tradeHistory: TradeHistoryItem[] } => {
  let currentBalance = startBalance;
  const riskDecimal = riskPerTrade / 100;
  const winRateDecimal = winRate / 100;
  const tradeHistory: TradeHistoryItem[] = [{ trade: 0, balance: startBalance }];

  for (let i = 1; i <= numTrades; i++) {
    const isWin = Math.random() < winRateDecimal;

    if (isWin) {
      currentBalance *= (1 + riskDecimal * rrRatio);
    } else {
      currentBalance *= (1 - riskDecimal);
    }

    tradeHistory.push({
      trade: i,
      balance: currentBalance,
      isWin: isWin
    });

    if (currentBalance <= 0.01) {
      currentBalance = 0;
      for (let j = i + 1; j <= numTrades; j++) {
        tradeHistory.push({ trade: j, balance: 0, isWin: false });
      }
      break;
    }
  }

  return { finalBalance: currentBalance, tradeHistory };
};

// Custom function to format currency consistently
const formatCurrency = (amount: number): string => {
    // Check if amount is a valid number, if not, return placeholder
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

// --- Custom Components ---

interface CardProps {
  children: React.ReactNode;
  className?: string;
}
const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 md:p-8 ${className}`}>
    {children}
  </div>
);

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[]; // Recharts payload structure is complex, using any[] for simplicity
  label?: string | number;
}
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    // Payload[0].payload contains the actual data object (TradeHistoryItem)
    const data: TradeHistoryItem = payload[0].payload; 
    const balance: number = payload[0].value;
    const isWin: boolean | undefined = data.isWin;

    return (
      <Card className="p-3 shadow-2xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-indigo-400/50">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Trade: {label}</p>
        <p className={`text-lg font-extrabold ${balance >= data.balance ? 'text-green-500' : 'text-red-500'}`}>
          Balance: ${formatCurrency(balance)}
        </p>
        {label && Number(label) > 0 && (
          <p className="text-xs mt-1">
            Outcome: <span className={`font-semibold ${isWin ? 'text-green-600' : 'text-red-600'}`}>{isWin ? 'Win' : 'Loss'}</span>
          </p>
        )}
      </Card>
    );
  }
  return null;
};

interface RangeInputGroupProps {
  fieldConfig: FieldLimitConfig & { name: keyof FormValues };
  formik: FormikProps<FormValues>;
}
// Component for Range (Slider) Inputs
const RangeInputGroup: React.FC<RangeInputGroupProps> = ({ fieldConfig, formik }) => {
  const { name, label, icon: Icon, min, max, step, unit } = fieldConfig;
  const value = formik.values[name];
  
  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    formik.setFieldValue(name, Number(e.target.value));
  };

  const displayValue = label === 'Starting Balance' ? value.toLocaleString() : value.toString();

  return (
    <div className="space-y-2">
      <label htmlFor={name} className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
        <Icon size={16} className="mr-2 text-indigo-500" />
        {label}: <span className="ml-1 font-semibold">{displayValue}{unit}</span>
      </label>
      
      <input
        type="range"
        id={name}
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleRangeChange}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
      />
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};

interface NumberInputGroupProps {
  fieldConfig: FieldLimitConfig & { name: keyof FormValues };
  formik: FormikProps<FormValues>;
}
// Component for Number Input Fields (with validation)
const NumberInputGroup: React.FC<NumberInputGroupProps> = ({ fieldConfig, formik }) => {
  const { name, label, icon: Icon, min, max, step, unit } = fieldConfig;
  
  // Use Formik's handleChange and handleBlur directly
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
        <Icon size={16} className="mr-2 text-indigo-500" />
        {label} ({min}{unit} - {max}{unit}):
      </label>
      
      <input
        id={name}
        name={name}
        type="number"
        min={min}
        max={max}
        step={step}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        value={formik.values[name]}
        className={`w-full p-3 border rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white 
          ${formik.touched[name] && formik.errors[name] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
        placeholder={`e.g., ${name === 'rrRatio' ? 4 : 100}`}
      />
      {(formik.touched[name] && formik.errors[name]) ? (
        <div className="text-red-500 text-xs font-medium">{formik.errors[name]}</div>
      ) : null}
    </div>
  );
};


// --- Main Application Component ---

export default function IonAppComponent(): JSX.Element {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [inputMode, setInputMode] = useState<'sliders' | 'numbers'>('sliders'); // 'sliders' or 'numbers'
  const [simulationActive, setSimulationActive] = useState<boolean>(false);

  // Set initial values from constants
  const initialValues: FormValues = useMemo(() => ({
    startBalance: 100, // Updated to 100 USD
    riskPerTrade: 10,
    rrRatio: 4,
    numTrades: 100,
    winRate: 50,
  }), []);
  
  // Use Formik for all input state management with FormValues type
  const formik = useFormik<FormValues>({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: () => {}, // Handled by useEffect
    validateOnChange: true,
    validateOnBlur: true,
  });
  
  // Destructure values from Formik for cleaner use
  const { startBalance, riskPerTrade, rrRatio, numTrades, winRate } = formik.values;

  const [simulationResults, setSimulationResults] = useState<SimulationResultsState>({
    finalBalance: initialValues.startBalance,
    tradeHistory: [{ trade: 0, balance: initialValues.startBalance }],
    winRateOutcomes: [],
  });
  
  // Check if Formik values are valid and ready to run simulation
  const areInputsValid: boolean = useMemo(() => {
    // Check if there are any errors in the Formik errors object
    const isEveryFieldValid = Object.keys(initialValues).every(key => formik.errors[key as keyof FormValues] === undefined);
    
    // Check if all fields have non-empty or non-null values
    const isEveryFieldNonEmpty = !Object.values(formik.values).some(v => v === '' || v === null);
    
    return isEveryFieldValid && isEveryFieldNonEmpty;
  }, [formik.errors, formik.values, initialValues]);

  // Calculate Break-Even Win Rate (Memoized)
  const breakEvenRate: number = useMemo(() => calculateBreakEvenRate(rrRatio), [rrRatio]);
  
  // Calculate P&L metrics
  const absoluteChange: number = simulationResults.finalBalance - startBalance;
  const percentageChange: number = (absoluteChange / startBalance) * 100;
  const isPositive: boolean = simulationResults.finalBalance >= startBalance;


  // Function to calculate final balances for multiple win rates (deterministic)
  const calculateWinRateOutcomes = useCallback((
    currentStartBalance: number,
    currentRisk: number,
    currentRR: number,
    currentNumTrades: number
  ): WinRateOutcome[] => {
    const outcomes: WinRateOutcome[] = [];
    for (let wr = 10; wr <= 90; wr += 10) {
      const winRateDecimal = wr / 100;
      const riskDecimal = currentRisk / 100;

      // Expected single trade multiplier:
      const winMultiplier = (1 + riskDecimal * currentRR);
      const lossMultiplier = (1 - riskDecimal);

      // Average multiplier per trade
      const averageMultiplier = (winRateDecimal * winMultiplier) + ((1 - winRateDecimal) * lossMultiplier);

      // Final balance after N trades based on expected value
      const finalBal = currentStartBalance * Math.pow(averageMultiplier, currentNumTrades);

      outcomes.push({
        winRate: wr,
        finalBalance: finalBal,
        isBreakEven: wr >= calculateBreakEvenRate(currentRR),
      });
    }
    return outcomes;
  }, []);

  // Main Simulation Effect - Runs on valid input changes
  useEffect(() => {
    // Only run simulation if all inputs are valid and not empty
    if (simulationActive && areInputsValid) {
      const { finalBalance, tradeHistory } = simulateTrades(
        startBalance,
        riskPerTrade,
        rrRatio,
        numTrades,
        winRate
      );

      const winRateOutcomes = calculateWinRateOutcomes(
          startBalance,
          riskPerTrade,
          rrRatio,
          numTrades
      );

      setSimulationResults({
        finalBalance,
        tradeHistory,
        winRateOutcomes,
      });
    } else if (simulationActive && !areInputsValid) {
         // Optionally reset results if inputs become invalid during an active simulation
         setSimulationResults({
            finalBalance: 0,
            tradeHistory: [{ trade: 0, balance: startBalance || 0 }],
            winRateOutcomes: [],
        });
    }
  }, [startBalance, riskPerTrade, rrRatio, numTrades, winRate, calculateWinRateOutcomes, simulationActive, areInputsValid]);

  // Handle initial active state setup
  useEffect(() => {
    // Activate simulation only once all initial values are valid
    if (areInputsValid && !simulationActive) {
      setSimulationActive(true);
    }
  }, [areInputsValid, simulationActive]);

  // Dark Mode Toggle Effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Function to re-run the *random* simulation only (for "Randomized Simulation Mode")
  const handleRandomize = () => {
    if (!areInputsValid) return; // Prevent randomization if inputs are invalid

    const { finalBalance, tradeHistory } = simulateTrades(
        startBalance,
        riskPerTrade,
        rrRatio,
        numTrades,
        winRate
      );

      // Keep winRateOutcomes stable, only update the trade history
      setSimulationResults(prev => ({
        ...prev,
        finalBalance,
        tradeHistory,
      }));
  }
  
  const handleClear = () => {
    // Set all values to empty strings to stop calculation
    // Note: We cast the values to FormValues type since resetForm expects the same type as Formik was initialized with.
    const emptyValues = Object.fromEntries(Object.keys(initialValues).map(key => [key, ''])) as FormValues;
    formik.resetForm({ values: emptyValues });
    
    // Explicitly untouch all fields for number inputs mode
    Object.keys(initialValues).forEach(key => {
        formik.setFieldTouched(key as keyof FormValues, false, false);
    });
    
    setSimulationActive(false);
    setSimulationResults({
      finalBalance: 0,
      tradeHistory: [{ trade: 0, balance: 0 }],
      winRateOutcomes: [],
    });
  };

  const { finalBalance, tradeHistory, winRateOutcomes } = simulationResults;

  // --- Render Logic ---

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors p-4 md:p-8 font-sans">
      {/* Header and Dark Mode Toggle */}
      <header className="flex justify-between items-center max-w-7xl mx-auto mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center">
            <Zap className="w-8 h-8 text-indigo-500 mr-3" />
            Forex Risk Simulator
        </h1>
        {/* <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:scale-105 transition-transform shadow-md"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button> */}
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- 1. Input Panel --- */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 border-b pb-2 border-gray-200 dark:border-gray-700">Simulation Settings</h2>
            
            {/* Input Mode Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6 shadow-inner">
                <button
                    onClick={() => setInputMode('sliders')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${inputMode === 'sliders' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                    Sliders
                </button>
                <button
                    onClick={() => setInputMode('numbers')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${inputMode === 'numbers' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                    Number Inputs
                </button>
            </div>

            <div className="space-y-6">
              {Object.keys(FIELD_LIMITS).map(fieldName => {
                const config = FIELD_LIMITS[fieldName as keyof FieldLimits];
                const configWithKey = { ...config, name: fieldName as keyof FormValues };
                if (inputMode === 'sliders') {
                  return <RangeInputGroup key={fieldName} fieldConfig={configWithKey} formik={formik} />;
                } else {
                  return <NumberInputGroup key={fieldName} fieldConfig={configWithKey} formik={formik} />;
                }
              })}
            </div>
            
            <div className="mt-8 flex space-x-4">
                <button
                    onClick={handleRandomize}
                    disabled={!areInputsValid}
                    className={`flex-1 py-3 text-white font-semibold rounded-lg shadow-lg transition-colors transform hover:scale-[1.01] flex items-center justify-center 
                        ${areInputsValid ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'}`}
                >
                    <Zap size={20} className="mr-2"/>
                    Randomize Sequence
                </button>
                <button
                    onClick={handleClear}
                    className="py-3 px-4 bg-red-100 text-red-600 font-semibold rounded-lg shadow-lg hover:bg-red-200 transition-colors"
                >
                    <Trash2 size={20}/>
                </button>
            </div>
            {!areInputsValid && (
                 <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg text-sm font-medium">
                    Please ensure all inputs are valid and filled to run the simulation.
                </div>
            )}
          </Card>
        </div>

        {/* --- 2. Results and Chart Panel --- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="text-center transition-all duration-500">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Final Account Balance</p>
              <p className={`mt-1 text-3xl font-extrabold ${isPositive ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                ${formatCurrency(finalBalance)}
              </p>
            </Card>
            <Card className="text-center transition-all duration-500">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">P&L (Profit/Loss)</p>
              <p className={`mt-1 text-3xl font-extrabold ${isPositive ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {absoluteChange.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </p>
              <p className={`mt-1 text-base font-semibold ${isPositive ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                 ({isPositive ? '+' : ''}{percentageChange.toFixed(2)}%)
              </p>
            </Card>
            <Card className="text-center transition-all duration-500">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Break-Even Win Rate</p>
              <p className="mt-1 text-3xl font-extrabold text-indigo-500 dark:text-indigo-400">
                {breakEvenRate.toFixed(1)}%
              </p>
            </Card>
          </div>

          {/* Balance Progression Chart */}
          <Card>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <DollarSign size={20} className="mr-2 text-indigo-500" />
                Balance Progression ({numTrades} Trades)
            </h2>
            <div className="h-80">
                {simulationActive && areInputsValid ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={tradeHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#4b5563' : '#e5e7eb'} />
                        <XAxis dataKey="trade" stroke={darkMode ? '#e5e7eb' : '#1f2937'} label={{ value: 'Trade Number', position: 'bottom', fill: darkMode ? '#e5e7eb' : '#1f2937' }} />
                        <YAxis domain={['auto', 'auto']} stroke={darkMode ? '#e5e7eb' : '#1f2937'} tickFormatter={(value) => `$${value.toLocaleString()}`} label={{ value: 'Account Balance', angle: -90, position: 'insideLeft', fill: darkMode ? '#e5e7eb' : '#1f2937' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" height={36} />
                        <Line
                            type="monotone"
                            dataKey="balance"
                            stroke={isPositive ? '#10b981' : '#ef4444'}
                            strokeWidth={2}
                            dot={false}
                            name="Account Balance"
                        />
                        <Line
                            type="monotone"
                            dataKey="balance"
                            stroke="#a855f7"
                            strokeWidth={1}
                            dot={false}
                            name="Starting Balance"
                            data={[{trade: 0, balance: startBalance}, {trade: numTrades, balance: startBalance}]}
                            isAnimationActive={false}
                            legendType="none"
                        />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-lg font-medium">
                        Enter valid simulation parameters to view the chart.
                    </div>
                )}
            </div>
          </Card>
          
          {/* Win Rate Outcomes Table */}
          <Card>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Table2 size={20} className="mr-2 text-indigo-500" />
                Deterministic Outcome Analysis
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider rounded-tl-lg">Win Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider rounded-tr-lg">Final Balance (Expected)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {simulationActive && areInputsValid ? (
                        winRateOutcomes.map((outcome: WinRateOutcome) => (
                            <tr
                                key={outcome.winRate}
                                className={`
                                    ${outcome.isBreakEven ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}
                                    ${outcome.winRate === winRate ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}
                                    hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                                `}
                            >
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {outcome.winRate}%
                                    {outcome.winRate === winRate && <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">Current</span>}
                                </td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${outcome.isBreakEven ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    ${formatCurrency(outcome.finalBalance)}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={2} className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                                Enter valid parameters to run the deterministic analysis.
                            </td>
                        </tr>
                    )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
      
      {/* --- 3. AdSense/Ad Manager Placement --- */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="p-4 md:p-6 rounded-xl border-2 border-dashed border-red-400 dark:border-red-600 bg-red-50 dark:bg-gray-800/50 shadow-inner text-center">
            <p className="text-xl font-bold text-red-700 dark:text-red-300 mb-4">
                [ Advertisement Placement: Banner/Video ]
            </p>
            {/* This is the dedicated space for your continuous-display ad unit (e.g., Google AdSense or Ad Manager tag). 
              
              Note: Actual ad scripts cannot run correctly in this isolated environment, 
              so this is a styled placeholder. 
              
              To implement, replace this comment block and the inner div below 
              with your provider's code snippet (e.g., <ins class="adsbygoogle" ...> or a video player tag).
            */}
            <div className="bg-gray-200 dark:bg-gray-700 w-full max-w-4xl mx-auto h-24 flex items-center justify-center rounded-lg text-lg font-semibold text-gray-600 dark:text-gray-300">
                Google/Programmatic Ad Placeholder (728x90)
            </div>
        </div>
      </div>
    </div>
  );
}
