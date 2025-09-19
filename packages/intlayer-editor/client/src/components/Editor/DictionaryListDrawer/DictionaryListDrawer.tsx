'use client';

import {
  Button,
  RightDrawer,
  useRightDrawerStore,
} from '@intlayer/design-system';
import {
  useDictionariesRecord,
  useEditedContent,
  useFocusDictionary,
} from '@intlayer/editor-react';
import { ChevronRight } from 'lucide-react';
import { type FC } from 'react';
import { useIntlayer } from 'react-intlayer';
import { getDrawerIdentifier } from '../DictionaryEditionDrawer/useDictionaryEditionDrawer';
import { dictionaryListDrawerIdentifier } from './dictionaryListDrawerIdentifier';

export const DictionaryListDrawer: FC = () => {
  const { drawerTitle, buttonLabel } = useIntlayer('dictionary-list-drawer');
  const { close: closeDrawer, open: openDrawer } = useRightDrawerStore();

  const { localeDictionaries } = useDictionariesRecord();
  const { editedContent } = useEditedContent();
  const { setFocusedContent } = useFocusDictionary();

  const handleClickDictionary = (dictionaryKey: string) => {
    closeDrawer(dictionaryListDrawerIdentifier);

    setFocusedContent({
      dictionaryKey,
    });

    openDrawer(getDrawerIdentifier(dictionaryKey));
  };

  const isDictionaryEdited = (dictionaryKey: string) =>
    Object.keys(editedContent ?? {}).includes(dictionaryKey);

  return (
    <RightDrawer
      title={drawerTitle.label.value}
      identifier={dictionaryListDrawerIdentifier}
    >
      {Object.values(localeDictionaries).map((dictionary) => {
        return (
          <div key={dictionary.localId!}>
            <Button
              label={
                buttonLabel.label({ dictionaryLocalId: dictionary.localId! })
                  .value
              }
              onClick={() => handleClickDictionary(dictionary.localId!)}
              variant="hoverable"
              color="text"
              IconRight={ChevronRight}
              size="md"
              isFullWidth
            >
              {isDictionaryEdited(dictionary.localId!)
                ? `✎ ${dictionary.key}`
                : dictionary.key}
            </Button>
          </div>
        );
      })}
    </RightDrawer>
  );
};
