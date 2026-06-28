export const TITLE_MAX_LENGTH = 120;

type TitleEntity = 'Article' | 'Task' | 'Ticket' | 'Subject' | 'Title';

export const getTitleLengthMessage = (entity: TitleEntity = 'Title') => (
  entity === 'Title'
    ? `Title is too long. Maximum ${TITLE_MAX_LENGTH} characters allowed.`
    : `${entity} title is too long. Maximum ${TITLE_MAX_LENGTH} characters allowed.`
);
