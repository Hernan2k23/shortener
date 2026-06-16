import { CodeShuffler } from '../services/code-shuffler.service';

const makeCodeShuffler = () => ({ sut: new CodeShuffler() });

describe('CodeShuffler', () => {
  describe('shuffle', () => {
    it('with an empty array, returns an empty array', () => {
      const { sut } = makeCodeShuffler();

      expect(sut.shuffle([])).toEqual([]);
    });

    it('with a single element, returns a copy of that element', () => {
      const { sut } = makeCodeShuffler();

      expect(sut.shuffle(['only'])).toEqual(['only']);
    });

    it('does not mutate the input array', () => {
      const { sut } = makeCodeShuffler();
      const input = ['a', 'b', 'c'];
      const snapshot = [...input];

      sut.shuffle(input);

      expect(input).toEqual(snapshot);
    });

    it('with Math.random pinned to 0, produces a deterministic permutation', () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
      try {
        const { sut } = makeCodeShuffler();
        expect(sut.shuffle(['a', 'b', 'c', 'd', 'e'])).toEqual(['b', 'c', 'd', 'e', 'a']);
      } finally {
        spy.mockRestore();
      }
    });

    it('with N elements, returns a permutation of the input (property check)', () => {
      const { sut } = makeCodeShuffler();
      const input = ['a', 'b', 'c', 'd', 'e'];
      const out = sut.shuffle(input);

      expect([...out].sort()).toEqual([...input].sort());
    });
  });
});
