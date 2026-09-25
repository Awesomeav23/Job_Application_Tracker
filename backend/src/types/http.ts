export type ApiErrorShape = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};
