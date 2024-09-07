'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { ChevronRight, ChevronLeft, DollarSign, InfoIcon } from 'lucide-react'
import Image from 'next/image'

const loanTypes = ['FHA', 'Conventional', 'VA', 'USDA']
const yesNoOptions = ['Yes', 'No']
const incomeTypes = ['W2', '1099', 'K1']

// Replace this with your actual Zapier webhook URL
const ZAPIER_WEBHOOK_URL = '/api/sendtozapier'

interface ZapierData {
  type: 'calculation_result' | 'pre_approval_request';
  [key: string]: string | number | boolean | object | null;
}

interface resultType {
  id: string;
  status: string;
  statusMessage: string;
  middleScore: number;
  dti: number;
  housingRatio: number;
  maxMonthlyPayment: number;
  lowPriceRange: number;
  highPriceRange: number;
}

export function MortgageReadinessCalculator() {
  const [step, setStep] = useState(1)
  const [monthlyDebt, setMonthlyDebt] = useState('')
  const [ficoScores, setFicoScores] = useState(['', '', ''])
  const [annualIncome, setAnnualIncome] = useState('')
  const [incomeType, setIncomeType] = useState('')
  const [loanType, setLoanType] = useState('')
  const [interestRate, setInterestRate] = useState(7)
  const [hasIncomeHistory, setHasIncomeHistory] = useState('')
  const [hasTaxRecords, setHasTaxRecords] = useState('')
  const [result, setResult] = useState<resultType | null>(null)
  const [error, setError] = useState('')
  const [showPreApprovalForm, setShowPreApprovalForm] = useState(false)
  const [preApprovalName, setPreApprovalName] = useState('')
  const [preApprovalEmail, setPreApprovalEmail] = useState('')
  const [preApprovalZip, setPreApprovalZip] = useState('')
  const [preApprovalPhone, setPreApprovalPhone] = useState('')
  const [preApprovalSubmitted, setPreApprovalSubmitted] = useState(false)
  const [revealProgress, setRevealProgress] = useState(0)
  const [calculationId, setCalculationId] = useState<string | null>(null)

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setRevealProgress(100)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [result])

  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
  }

  const sendToZapier = async (data: ZapierData) => {
    try {
      const response = await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to send data to Zapier')
      }
    } catch (error) {
      console.error('Error sending data to Zapier:', error)
    }
  }

  const calculateMortgageReadiness = () => {
    try {
      if (!validateInputs()) return

      const sortedScores = [...ficoScores].map(Number).sort((a, b) => a - b)
      const middleScore = sortedScores[1]
      const monthlyIncome = Number(annualIncome) / 12
      const dti = (Number(monthlyDebt) / monthlyIncome) * 100
      const housingRatio = 31
      const maxMonthlyPayment = (monthlyIncome * housingRatio) / 100

      const monthlyInterestRate = interestRate / 100 / 12
      const numberOfPayments = 30 * 12
      const loanAmount = maxMonthlyPayment * ((1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments)) / monthlyInterestRate)
      const housePrice = loanAmount / 0.8
      const lowPriceRange = Math.max(0, housePrice - 15000)
      const highPriceRange = housePrice + 15000

      let status = "Ready"
      let statusMessage = "Congratulations! Based on the information provided, you appear to be ready to apply for a mortgage."
      if (middleScore < 660) {
        status = "Not Ready"
        statusMessage = "Your credit score may make it difficult to secure a mortgage at this time."
      } else if (dti > 43) {
        status = "Not Ready"
        statusMessage = "Your debt-to-income ratio is higher than typically accepted for mortgages."
      } else if (hasIncomeHistory === 'No' || hasTaxRecords === 'No') {
        status = "Not Ready"
        statusMessage = "You may need more income history or up-to-date tax records."
      }

      const newCalculationId = generateUniqueId()
      setCalculationId(newCalculationId)

      const calculationResult = {
        id: newCalculationId,
        status,
        statusMessage,
        middleScore,
        dti,
        housingRatio,
        maxMonthlyPayment,
        lowPriceRange,
        highPriceRange
      }

      setResult(calculationResult)
      setRevealProgress(0)
      setStep(4)

      sendToZapier({
        type: 'calculation_result',
        ...calculationResult,
        monthlyDebt,
        annualIncome,
        ficoScores,
        incomeType,
        loanType,
        interestRate,
        hasIncomeHistory,
        hasTaxRecords
      })
    } catch (error) {
      console.error("Calculation error:", error)
      setError("An error occurred during calculation. Please check your inputs and try again.")
    }
  }

  const validateInputs = () => {
    if (!monthlyDebt || !annualIncome || ficoScores.some(score => !score) || !incomeType || !loanType || !hasIncomeHistory || !hasTaxRecords) {
      setError('Please fill in all fields.')
      return false
    }
    setError('')
    return true
  }

  const handlePreApprovalSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log('Pre-approval request submitted:', { preApprovalName, preApprovalEmail, preApprovalZip, preApprovalPhone })
    setPreApprovalSubmitted(true)
    sendToZapier({
      type: 'pre_approval_request',
      name: preApprovalName,
      email: preApprovalEmail,
      zip: preApprovalZip,
      phone: preApprovalPhone,
      calculationId,
      ...result,
      monthlyDebt,
      annualIncome,
      ficoScores,
      incomeType,
      loanType,
      interestRate,
      hasIncomeHistory,
      hasTaxRecords
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value / 100)
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <CardTitle className="mb-4 text-xl sm:text-2xl">Financial Information</CardTitle>
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Monthly Debt Obligation</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                  <Input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={monthlyDebt}
                    onChange={(e) => setMonthlyDebt(e.target.value)}
                    placeholder="Enter monthly debt"
                    className="pl-8"
                  />
                </div>
                <Alert className="mt-2">
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>What to include in monthly debt:</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5 text-sm">
                      <li>Credit card minimum payments</li>
                      <li>Personal loan payments</li>
                      <li>Car loan payments</li>
                      <li>Previous mortgage payments</li>
                      <li>Line of credit payments</li>
                    </ul>
                    <p className="mt-2 text-sm">Do not include rent, utilities, or other living expenses.</p>
                  </AlertDescription>
                </Alert>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Annual Income</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                  <Input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(e.target.value)}
                    placeholder="Enter annual income"
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Income Type</label>
                <Select onValueChange={setIncomeType} value={incomeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select income type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )
      case 2:
        return (
          <>
            <CardTitle className="mb-4 text-xl sm:text-2xl">Credit Information</CardTitle>
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium">FICO 8 Credit Scores</label>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  {ficoScores.map((score, index) => (
                    <Input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={score}
                      onChange={(e) => {
                        const newScores = [...ficoScores]
                        newScores[index] = e.target.value
                        setFicoScores(newScores)
                      }}
                      placeholder={`Score ${index + 1}`}
                      className="w-full sm:w-1/3"
                    />
                  ))}
                </div>
                <Alert className="mt-2">
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>FICO 8 Score Information</AlertTitle>
                  <AlertDescription className="text-sm">
                    <p>FICO 8 is a credit scoring model used by many lenders to assess creditworthiness. It ranges from 300 to 850.</p>
                    <p className="mt-2">To get your FICO 8 scores:</p>
                    <ul className="list-disc pl-5 mt-1">
                      <li>Check with your credit card issuer (many provide free FICO scores)</li>
                      <li>Use a credit monitoring service</li>
                      <li>Purchase your scores directly from FICO at myfico.com</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Loan Type</label>
                <Select onValueChange={setLoanType} value={loanType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select loan type" />
                  </SelectTrigger>
                  <SelectContent>
                    {loanTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Interest Rate: {interestRate}%</label>
                <Slider
                  min={1}
                  max={12}
                  step={0.1}
                  value={[interestRate]}
                  onValueChange={(value) => setInterestRate(value[0])}
                />
              </div>
            </div>
          </>
        )
      case 3:
        return (
          <>
            <CardTitle className="mb-4 text-xl sm:text-2xl">Additional Information</CardTitle>
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Do you have 2 years of income history in your current profession?</label>
                <Select onValueChange={setHasIncomeHistory} value={hasIncomeHistory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Yes or No" />
                  </SelectTrigger>
                  <SelectContent>
                    {yesNoOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Do you have up to date tax records for the last 2 years?</label>
                <Select onValueChange={setHasTaxRecords} value={hasTaxRecords}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Yes or No" />
                  </SelectTrigger>
                  <SelectContent>
                    {yesNoOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )
      case 4:
        return (
          <>
            <CardTitle className="mb-4 text-xl sm:text-2xl">Results</CardTitle>
            {result && (
              <div className="space-y-4">
                <div className="relative overflow-hidden">
                  <div 
                    className="absolute inset-0 bg-gray-200 animate-pulse"
                    style={{ clipPath: `inset(0 ${100 - revealProgress}% 0 0)` }}
                  ></div>
                  <Alert variant={result.status === "Ready" ? "default" : "destructive"} className={result.status === "Ready" ? "bg-green-100 border-green-400 text-green-800" : "bg-red-100 border-red-400 text-red-800"}>
                    <AlertTitle className="text-lg font-bold">Status: {result.status}</AlertTitle>
                    <AlertDescription className="mt-2">{result.statusMessage}</AlertDescription>
                  </Alert>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-sm">Middle Credit Score</p>
                    <p className="text-xl sm:text-2xl font-bold">{result.middleScore}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Debt-to-Income Ratio</p>
                    <p className="text-xl sm:text-2xl font-bold">{formatPercentage(result.dti)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Housing Ratio</p>
                    <p className="text-xl sm:text-2xl font-bold">{formatPercentage(result.housingRatio)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Max Monthly Payment</p>
                    <p className="text-xl sm:text-2xl font-bold">{formatCurrency(result.maxMonthlyPayment)}</p>
                  </div>
                </div>
                <div className="bg-indigo-100 p-4 rounded-lg">
                  <p className="font-semibold text-indigo-800 text-sm">Estimated Home Price Range</p>
                  <p className="text-xl sm:text-2xl font-bold text-indigo-900">{formatCurrency(result.lowPriceRange)} - {formatCurrency(result.highPriceRange)}</p>
                  <Alert className="mt-2 bg-white">
                    <InfoIcon className="h-4 w-4" />
                    <AlertTitle>Important Note</AlertTitle>
                    <AlertDescription className="text-sm">
                      This is a preliminary estimate based on the information provided. The price range shown reflects what you might be able to afford based on your current income, regardless of your mortgage readiness status. For a final approval and accurate price range, please consult with a licensed loan officer who can review your complete financial profile.
                    </AlertDescription>
                  </Alert>
                </div>
                <Alert>
                  <AlertTitle className="text-lg font-bold">Credit Score Information</AlertTitle>
                  <AlertDescription className="text-sm">
                    A good credit score to aim for when applying for a mortgage is typically 680 or higher. This can help you secure better interest rates and loan terms. If your score is below this, consider working on improving it before applying for a mortgage.
                  </AlertDescription>
                </Alert>
                <Alert>
                  <AlertTitle className="text-lg font-bold">Next Steps</AlertTitle>
                  <AlertDescription className="text-sm">
                    Regardless of your current status, it&apos;s recommended to consult with a mortgage loan officer for a comprehensive assessment and personalized advice. They can provide a final decision and guide you through the mortgage application process or help you create a plan to become mortgage-ready.
                  </AlertDescription>
                </Alert>
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <Image
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_4013-gbDCsmMEjwLLUgUxBPyqDAvlOScvvD.JPG"
                      alt="Caneshia Cottrell, Mortgage Loan Officer"
                      width={200}
                      height={200}
                      className="rounded-lg"
                    />
                    <div className="text-center sm:text-left">
                      <h3 className="text-xl font-semibold mb-2">Meet Your Mortgage Loan Officer</h3>
                      <p className="text-sm">
                        Hi, I&apos;m Caneshia! My mission is to provide every potential borrower with the keys to unlock their dream property. Whether you&apos;re securing your first home, upgrading to a vacation getaway, investing in income-generating properties, or purchasing commercial buildings, I am here to guide you every step of the way.
                      </p>
                    </div>
                  </div>
                </div>
                {!showPreApprovalForm && !preApprovalSubmitted && (
                  <div>
                    <Button onClick={() => setShowPreApprovalForm(true)} className="w-full mb-2">
                      Get Pre-Approval
                    </Button>
                    <p className="text-sm text-gray-600 text-center">
                      Licensed Loan Officer: Caneshia Cottrell<br />
                      NMLS #: 1370398
                    </p>
                  </div>
                )}
                {showPreApprovalForm && !preApprovalSubmitted && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Get Pre-Approval</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handlePreApprovalSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="preApprovalName" className="block mb-1 text-sm font-medium">Full Name</label>
                          <Input
                            id="preApprovalName"
                            type="text"
                            value={preApprovalName}
                            onChange={(e) => setPreApprovalName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="preApprovalEmail" className="block mb-1 text-sm font-medium">Email Address</label>
                          <Input
                            id="preApprovalEmail"
                            type="email"
                            value={preApprovalEmail}
                            onChange={(e) => setPreApprovalEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="preApprovalZip" className="block mb-1 text-sm font-medium">ZIP Code</label>
                          <Input
                            id="preApprovalZip"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={preApprovalZip}
                            onChange={(e) => setPreApprovalZip(e.target.value)}
                            placeholder="Enter your ZIP code"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="preApprovalPhone" className="block mb-1 text-sm font-medium">Phone Number</label>
                          <Input
                            id="preApprovalPhone"
                            type="tel"
                            value={preApprovalPhone}
                            onChange={(e) => setPreApprovalPhone(e.target.value)}
                            placeholder="Enter your phone number"
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full">Submit Pre-Approval Request</Button>
                      </form>
                    </CardContent>
                  </Card>
                )}
                {preApprovalSubmitted && (
                  <Alert className="bg-green-100 border-green-400 text-green-800">
                    <AlertTitle className="text-lg font-bold">Thank You!</AlertTitle>
                    <AlertDescription className="text-sm">
                      We&apos;ve received your pre-approval request. A mortgage specialist will contact you soon to discuss your options.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </>
        )
      default:
        return null
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl font-bold">Mortgage Readiness Calculator</CardTitle>
        <Progress value={(step / 4) * 100} className="w-full" />
      </CardHeader>
      <CardContent>
        {renderStep()}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between space-y-2 sm:space-y-0">
        {step > 1 && step < 4 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} className="w-full sm:w-auto">
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
        )}
        {step < 3 && (
          <Button onClick={() => setStep(step + 1)} className="w-full sm:w-auto sm:ml-auto">
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        {step === 3 && (
          <Button onClick={calculateMortgageReadiness} className="w-full sm:w-auto sm:ml-auto">
            Calculate Readiness
          </Button>
        )}
        {step === 4 && (
          <Button onClick={() => setStep(1)} variant="outline" className="w-full sm:w-auto sm:ml-auto">
            Start Over
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}