'use client';

import { useAskResetPassword } from '@intlayer/design-system/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FC, useRef } from 'react';
import { PagesRoutes } from '@/Routes';
import {
  type AskResetPassword,
  AskResetPasswordForm as ResetPasswordFormUI,
} from './AskResetPasswordForm';

type AskResetPasswordFormProps = {
  email?: string;
  callbackUrl?: string;
};

export const AskResetPasswordForm: FC<AskResetPasswordFormProps> = ({
  email,
  callbackUrl = PagesRoutes.Auth_SignIn,
}) => {
  const router = useRouter();
  const { mutate: askResetPassword } = useAskResetPassword();
  const searchParams = useSearchParams();
  const emailFromParams = searchParams.get('email');
  const emailInputRef = useRef<HTMLInputElement>(null);

  const onSubmitSuccess = ({ email }: AskResetPassword) => {
    askResetPassword({
      email,
      redirectTo: `${process.env.NEXT_PUBLIC_URL}/${callbackUrl}`,
    });
  };

  const getEmailContext = () => {
    const email = searchParams.get('email');

    if (email) {
      return email;
    } else {
      const emailFromInput = emailInputRef.current;
      return emailFromInput?.value;
    }
  };

  const onClickBackToLogin = () => {
    const email = getEmailContext();

    if (email) {
      router.push(`${callbackUrl}?email=${email}`);
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <ResetPasswordFormUI
      onSubmitSuccess={onSubmitSuccess}
      email={email ?? emailFromParams ?? undefined}
      onClickBackToLogin={onClickBackToLogin}
      emailInputRef={emailInputRef}
    />
  );
};
