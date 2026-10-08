"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff } from "lucide-react";

const WingedTruckIcon = ({ className = "w-10 h-10 text-cyan-400", ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0C2.678 5.57 2.25 6.05 2.25 6.618v8.632m12 0H2.25" />
  </svg>
);

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  rememberMe: z.boolean().default(false).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const handleFormSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      await onLogin();
    } catch (error) {
      console.error("Submission failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } },
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col md:flex-row bg-slate-950">
      {/* Left Panel: Form */}
      <div className="flex w-full flex-col items-center justify-center bg-slate-950 p-8 md:w-1/2 min-h-screen">
        <div className="w-full max-w-md">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6"
          >
            <motion.div variants={itemVariants} className="mb-2">
              <div className="flex items-center gap-3">
                <WingedTruckIcon />
                <span className="text-xl font-bold tracking-wider text-white font-mono">
                  FREIGHT COPILOT
                </span>
              </div>
            </motion.div>
            <motion.div variants={itemVariants} className="text-left">
              <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-400">
                Sign in to access your dispatch stream and live load pipelines.
              </p>
            </motion.div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">
                <motion.div variants={itemVariants}>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Email Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="name@company.com"
                            {...field}
                            disabled={isLoading}
                            className="bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              {...field}
                              disabled={isLoading}
                              className="bg-slate-900 border-slate-700 text-white placeholder-slate-500 pr-12 focus:border-cyan-400 focus:ring-cyan-400/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="flex items-center justify-between">
                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isLoading}
                            className="data-[state=checked]:bg-cyan-400 data-[state=checked]:text-slate-950 border-slate-600 focus:ring-cyan-400/20"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-normal text-slate-300 cursor-pointer">
                            Remember me
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <a
                    href="#"
                    className="text-sm font-medium text-cyan-400 hover:underline"
                  >
                    Forgot password?
                  </a>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Button
                    type="submit"
                    className="w-full bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-black font-semibold py-3 rounded-lg transition-all focus:ring-2 focus:ring-cyan-400/50"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </motion.div>
              </form>
            </Form>

            <motion.p variants={itemVariants} className="text-center text-sm text-slate-400">
              Don&apos;t have an account?{" "}
              <a href="#" className="font-medium text-cyan-400 hover:underline">
                Create one here
              </a>
              .
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Right Panel: Hero Banner */}
      <div className="relative hidden w-1/2 md:block min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-400/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(15,23,42,1)_0%,_rgba(15,23,42,0)_50%,_rgba(15,23,42,1)_100%)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Cfilter%20id%3D%22noise%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23noise)%22%20opacity%3D%220.03%22%2F%3E%3C%2Fsvg%3E')] opacity-50" />
        
        <div className="relative z-10 flex flex-col items-center gap-8 px-8">
          <div className="relative">
            <div className="absolute -inset-4 bg-cyan-400/20 rounded-full blur-[100px] animate-pulse" style={{ width: '240px', height: '240px' }} />
            <div className="absolute -inset-8 bg-cyan-400/10 rounded-full blur-[150px]" style={{ width: '280px', height: '280px' }} />
            <div className="relative w-32 h-32">
              <WingedTruckIcon className="w-full h-full drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]" />
            </div>
          </div>
          <div className="text-center">
            <span className="block text-6xl font-bold tracking-tight text-white font-mono">FREIGHT</span>
            <span className="block text-6xl font-bold tracking-tight text-cyan-400 font-mono">COPILOT</span>
            <p className="mt-6 text-lg text-slate-400 max-w-xs mx-auto">
              Intelligent dispatch. Real-time visibility. Zero friction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}